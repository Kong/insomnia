import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { database as db } from '../../../common/database';
import { RepoFileWatcherRegistry } from '../repo-file-watcher';

vi.mock('../../../common/insomnia-v5', () => ({
  getInsomniaV5DataExport: vi.fn().mockResolvedValue('type: collection.insomnia.rest/5.0\nname: Exported\n'),
  tryImportV5Data: vi.fn().mockReturnValue({ data: undefined, error: undefined }),
}));

const REPO_ID = 'git_repo_test';
const PROJECT_ID = 'proj_test';
const VICTIM_CONTENT = 'do not overwrite\n';

// A cloned/pulled repo is attacker controlled and may contain symlinks. The watcher's DB -> disk flush
// must never write through one that leaves the repo, even though the lexical path stays inside it.
describe('RepoFileWatcher disk writes through symlinks', () => {
  let repoDir: string;
  let outsideDir: string;
  let registry: RepoFileWatcherRegistry;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    const root = await fs.promises.realpath(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-watcher-symlink-')));
    repoDir = path.join(root, 'repo');
    outsideDir = path.join(root, 'outside');
    await fs.promises.mkdir(repoDir);
    await fs.promises.mkdir(outsideDir);
    registry = new RepoFileWatcherRegistry({ onDbSynced: vi.fn(), onProblemsChanged: vi.fn() });
  });

  afterEach(async () => {
    registry.stopAll();
    await fs.promises.rm(path.dirname(repoDir), { recursive: true, force: true });
    vi.clearAllMocks();
  });

  const createWorkspaceWithMeta = async (gitFilePath: string) => {
    const workspace = await services.workspace.create({ name: 'WS', scope: 'collection', parentId: PROJECT_ID });
    const meta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);
    await services.workspaceMeta.update(meta, { gitFilePath, gitFileLastSyncTime: null });
  };

  it('does not write a workspace file through a symlinked file that points outside the repo', async () => {
    const victim = path.join(outsideDir, 'victim.txt');
    await fs.promises.writeFile(victim, VICTIM_CONTENT);
    await fs.promises.symlink(victim, path.join(repoDir, 'insomnia.wrk.yaml'));
    await createWorkspaceWithMeta('insomnia.wrk.yaml');

    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);
    await registry.flushNow(REPO_ID);

    expect(await fs.promises.readFile(victim, 'utf8')).toBe(VICTIM_CONTENT);
  });

  it('does not write a workspace file through a symlinked folder that points outside the repo', async () => {
    await fs.promises.symlink(outsideDir, path.join(repoDir, 'sub'));
    await createWorkspaceWithMeta('sub/ws.yaml');

    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);
    await registry.flushNow(REPO_ID);

    expect(fs.existsSync(path.join(outsideDir, 'ws.yaml'))).toBe(false);
  });

  it('does not write the project lint ruleset through a symlinked .spectral.yaml that points outside the repo', async () => {
    const victim = path.join(outsideDir, 'victim.txt');
    await fs.promises.writeFile(victim, VICTIM_CONTENT);
    await fs.promises.symlink(victim, path.join(repoDir, '.spectral.yaml'));
    await services.projectLintRuleset.upsert(PROJECT_ID, { rulesetContent: 'extends: []\nrules: {}\n' });

    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);
    await registry.flushNow(REPO_ID);

    expect(await fs.promises.readFile(victim, 'utf8')).toBe(VICTIM_CONTENT);
  });

  it('still writes a workspace file through a symlinked folder that stays inside the repo', async () => {
    await fs.promises.mkdir(path.join(repoDir, 'real'));
    await fs.promises.symlink(path.join(repoDir, 'real'), path.join(repoDir, 'sub'));
    await createWorkspaceWithMeta('sub/ws.yaml');

    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);
    await registry.flushNow(REPO_ID);

    expect(fs.existsSync(path.join(repoDir, 'real', 'ws.yaml'))).toBe(true);
  });
});
