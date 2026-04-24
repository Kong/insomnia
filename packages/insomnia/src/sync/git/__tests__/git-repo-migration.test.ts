import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { services } from '~/insomnia-data';

import { database as db } from '../../../common/database';
import { CURRENT_MIGRATION_VERSION, migrateRepoStructureIfNeeded } from '../git-repo-migration';

vi.mock('../../../common/insomnia-v5', () => ({
  getInsomniaV5DataExport: vi.fn().mockResolvedValue(''),
}));

const mkDir = (dirPath: string) => fs.promises.mkdir(dirPath, { recursive: true });
const fileExists = (filePath: string) =>
  fs.promises
    .access(filePath)
    .then(() => true)
    .catch(() => false);
const dirExists = (dirPath: string) =>
  fs.promises
    .stat(dirPath)
    .then(s => s.isDirectory())
    .catch(() => false);

type LogEntry = string;
const makeLogger = () => {
  const logs: LogEntry[] = [];
  const logger = (level: 'info' | 'warn' | 'error', message: string) =>
    logs.push(`[${level.toUpperCase()}] ${message}`);
  return { logs, logger };
};

describe('migrateRepoStructureIfNeeded', () => {
  let baseDir: string;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    baseDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-git-migration-'));
  });

  afterEach(async () => {
    await fs.promises.rm(baseDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns true immediately when already migrated and no old directories exist', async () => {
    await services.gitRepository.create({ _id: 'git_repo_a', repoMigrationVersion: CURRENT_MIGRATION_VERSION });
    const { logs, logger } = makeLogger();

    const result = await migrateRepoStructureIfNeeded(baseDir, 'proj_a', 'git_repo_a', logger);

    expect(result).toBe(true);
    expect(logs).toHaveLength(0);
  });

  it('re-runs migration when old git/ directory exists even if version stamp is current', async () => {
    await services.gitRepository.create({ _id: 'git_repo_b', repoMigrationVersion: CURRENT_MIGRATION_VERSION });
    await mkDir(path.join(baseDir, 'git'));
    await fs.promises.writeFile(path.join(baseDir, 'git', 'config'), '[core]\n\trepositoryformatversion = 0');
    const { logger } = makeLogger();

    const result = await migrateRepoStructureIfNeeded(baseDir, 'proj_b', 'git_repo_b', logger);

    expect(result).toBe(true);
    expect(await dirExists(path.join(baseDir, '.git'))).toBe(true);
    expect(await dirExists(path.join(baseDir, 'git'))).toBe(false);
  });

  it('renames git/ to .git/ and preserves contents', async () => {
    await services.gitRepository.create({ _id: 'git_repo_c' });
    await mkDir(path.join(baseDir, 'git'));
    await fs.promises.writeFile(path.join(baseDir, 'git', 'config'), '[core]\n\trepositoryformatversion = 0');
    const { logger } = makeLogger();

    const result = await migrateRepoStructureIfNeeded(baseDir, 'proj_c', 'git_repo_c', logger);

    expect(result).toBe(true);
    expect(await dirExists(path.join(baseDir, '.git'))).toBe(true);
    expect(await fileExists(path.join(baseDir, '.git', 'config'))).toBe(true);
    expect(await dirExists(path.join(baseDir, 'git'))).toBe(false);
  });

  it('moves other/ contents to repo root', async () => {
    await services.gitRepository.create({ _id: 'git_repo_d' });
    await mkDir(path.join(baseDir, 'other'));
    await fs.promises.writeFile(path.join(baseDir, 'other', 'README.md'), '# Hello');
    const { logger } = makeLogger();

    const result = await migrateRepoStructureIfNeeded(baseDir, 'proj_d', 'git_repo_d', logger);

    expect(result).toBe(true);
    expect(await fileExists(path.join(baseDir, 'README.md'))).toBe(true);
    expect(await dirExists(path.join(baseDir, 'other'))).toBe(false);
  });

  it('writes workspace YAML to disk', async () => {
    const { getInsomniaV5DataExport } = await import('../../../common/insomnia-v5');
    vi.mocked(getInsomniaV5DataExport).mockResolvedValueOnce('name: My Workspace\n');

    await services.gitRepository.create({ _id: 'git_repo_e' });
    await services.project.create({ _id: 'proj_e', name: 'Test Project' });
    await services.workspace.create({ _id: 'wrk_e', name: 'My Workspace', parentId: 'proj_e', scope: 'collection' });
    const { logger } = makeLogger();

    await migrateRepoStructureIfNeeded(baseDir, 'proj_e', 'git_repo_e', logger);

    const yamlPath = path.join(baseDir, 'insomnia.wrk_e.yaml');
    expect(await fileExists(yamlPath)).toBe(true);
    const content = await fs.promises.readFile(yamlPath, 'utf8');
    expect(content).toBe('name: My Workspace\n');
  });

  it('does not include the repo ID in any log message', async () => {
    await services.gitRepository.create({ _id: 'git_repo_f' });
    await mkDir(path.join(baseDir, 'git'));
    await fs.promises.writeFile(path.join(baseDir, 'git', 'config'), '[core]');
    const { logs, logger } = makeLogger();

    await migrateRepoStructureIfNeeded(baseDir, 'proj_f', 'git_repo_f', logger);

    for (const entry of logs) {
      expect(entry).not.toContain('git_repo_f');
    }
  });

  it('returns false and includes stack trace in error log when migration fails', async () => {
    await services.gitRepository.create({ _id: 'git_repo_g' });

    const error = new Error('DB write failed');
    error.stack = 'Error: DB write failed\n    at markMigrated (git-repo-migration.ts:70)';
    vi.spyOn(db, 'docUpdate').mockRejectedValueOnce(error);

    const { logs, logger } = makeLogger();
    const result = await migrateRepoStructureIfNeeded(baseDir, 'proj_g', 'git_repo_g', logger);

    expect(result).toBe(false);
    const errorEntry = logs.find(l => l.startsWith('[ERROR]'));
    expect(errorEntry).toBeDefined();
    expect(errorEntry).toContain('DB write failed');
    expect(errorEntry).toContain('at markMigrated');
  });
});
