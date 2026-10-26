import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { database as db } from '~/common/database';

// git-service.ts pulls in main/analytics.ts, which pulls in @sentry/electron
// and other Electron-main-process-only globals that aren't relevant to the
// folder-relocation logic under test here (and don't play well with the
// project's lightweight `electron` test mock). Replace it with a no-op that
// keeps the real, dependency-free `AnalyticsEvent` enum intact.
vi.mock('~/main/analytics', async () => {
  const { AnalyticsEvent } = await import('insomnia-analytics');
  return {
    AnalyticsEvent,
    trackAnalyticsEvent: vi.fn(),
    setCurrentOrganizationId: vi.fn(),
    trackPageView: vi.fn(),
  };
});

const { relocateGitRepoAction, resolveGitRepoFolderPathAction } = await import('~/main/git-service');

const PROJECT_ID = 'proj_test';

describe('resolveGitRepoFolderPathAction', () => {
  let repoDir: string;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    repoDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-repo-folder-'));
  });

  afterEach(async () => {
    await fs.promises.rm(repoDir, { recursive: true, force: true });
  });

  it('returns the path without touching disk when the folder exists', async () => {
    const repo = await services.gitRepository.create({ uri: 'https://example.com/foo.git', directory: repoDir });

    const result = await resolveGitRepoFolderPathAction({ gitRepositoryId: repo._id });

    expect(result).toEqual({ path: repoDir });
  });

  // Regression: clicking "Open in file system" after the folder was renamed/
  // moved/deleted outside Insomnia used to silently `mkdir -p` it back into
  // existence and open the resurrected empty folder. It must instead report
  // the folder missing and create nothing.
  it('reports an error and creates nothing when the folder was moved/renamed/deleted externally', async () => {
    const repo = await services.gitRepository.create({ uri: 'https://example.com/foo.git', directory: repoDir });

    await fs.promises.rm(repoDir, { recursive: true, force: true });

    const result = await resolveGitRepoFolderPathAction({ gitRepositoryId: repo._id });

    expect(result.path).toBeUndefined();
    expect(result.errors?.[0]).toContain('Repository folder not found');
    const recreated = await fs.promises
      .access(repoDir)
      .then(() => true)
      .catch(() => false);
    expect(recreated).toBe(false);
  });

  it('errors for an unknown repository id', async () => {
    const result = await resolveGitRepoFolderPathAction({ gitRepositoryId: 'git_does_not_exist' });
    expect(result.errors?.[0]).toContain('Git repository not found');
  });
});

describe('relocateGitRepoAction', () => {
  let parentDir: string;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    parentDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-relocate-'));
  });

  afterEach(async () => {
    await fs.promises.rm(parentDir, { recursive: true, force: true });
  });

  const readFile = (p: string) => fs.promises.readFile(p, 'utf8').catch(() => null);

  it('moves the repository into an empty target folder', async () => {
    const currentDir = path.join(parentDir, 'current');
    await fs.promises.mkdir(currentDir, { recursive: true });
    await fs.promises.writeFile(path.join(currentDir, 'insomnia.wrk_a.yaml'), 'name: A\n', 'utf8');

    const repo = await services.gitRepository.create({ uri: 'https://example.com/foo.git', directory: currentDir });

    const targetDir = path.join(parentDir, 'moved');
    const result = await relocateGitRepoAction({ gitRepositoryId: repo._id, projectId: PROJECT_ID, newDirectory: targetDir });

    expect(result).toEqual({ directory: targetDir });
    expect(await readFile(path.join(targetDir, 'insomnia.wrk_a.yaml'))).toBe('name: A\n');
    const oldStillThere = await fs.promises
      .access(currentDir)
      .then(() => true)
      .catch(() => false);
    expect(oldStillThere).toBe(false);

    const updated = await services.gitRepository.getById(repo._id);
    expect(updated?.directory).toBe(targetDir);
  });

  // Regression ("reconnect after external rename"): the folder was renamed/
  // moved outside Insomnia and already contains its own `.git` — relocating
  // onto it must ADOPT it in place (repoint `directory` only) rather than
  // refusing, or trying to move/overwrite it.
  it('adopts a target folder that already contains a git repo, without moving or copying anything', async () => {
    const currentDir = path.join(parentDir, 'stale-path'); // no longer exists on disk
    const renamedDir = path.join(parentDir, 'already-renamed');
    await fs.promises.mkdir(path.join(renamedDir, '.git'), { recursive: true });
    await fs.promises.writeFile(path.join(renamedDir, 'insomnia.wrk_a.yaml'), 'name: Renamed\n', 'utf8');

    const repo = await services.gitRepository.create({ uri: 'https://example.com/foo.git', directory: currentDir });

    const result = await relocateGitRepoAction({ gitRepositoryId: repo._id, projectId: PROJECT_ID, newDirectory: renamedDir });

    expect(result).toEqual({ directory: renamedDir });
    // The pre-existing content must be untouched — this was an adopt, not a move.
    expect(await readFile(path.join(renamedDir, 'insomnia.wrk_a.yaml'))).toBe('name: Renamed\n');

    const updated = await services.gitRepository.getById(repo._id);
    expect(updated?.directory).toBe(renamedDir);
  });

  it('refuses to relocate onto a non-empty folder that is not a git repository', async () => {
    const currentDir = path.join(parentDir, 'current');
    await fs.promises.mkdir(currentDir, { recursive: true });

    const targetDir = path.join(parentDir, 'has-other-stuff');
    await fs.promises.mkdir(targetDir, { recursive: true });
    await fs.promises.writeFile(path.join(targetDir, 'unrelated.txt'), 'not a repo', 'utf8');

    const repo = await services.gitRepository.create({ uri: 'https://example.com/foo.git', directory: currentDir });

    const result = await relocateGitRepoAction({ gitRepositoryId: repo._id, projectId: PROJECT_ID, newDirectory: targetDir });

    expect(result.errors?.[0]).toContain("isn't a git repository");
    // Must not have touched the unrelated file.
    expect(await readFile(path.join(targetDir, 'unrelated.txt'))).toBe('not a repo');
  });

  it('moves into a target folder that only has a macOS .DS_Store file', async () => {
    const currentDir = path.join(parentDir, 'current');
    await fs.promises.mkdir(currentDir, { recursive: true });
    await fs.promises.writeFile(path.join(currentDir, 'insomnia.wrk_a.yaml'), 'name: A\n', 'utf8');

    const targetDir = path.join(parentDir, 'ds-store-only');
    await fs.promises.mkdir(targetDir, { recursive: true });
    await fs.promises.writeFile(path.join(targetDir, '.DS_Store'), 'junk', 'utf8');

    const repo = await services.gitRepository.create({ uri: 'https://example.com/foo.git', directory: currentDir });

    const result = await relocateGitRepoAction({ gitRepositoryId: repo._id, projectId: PROJECT_ID, newDirectory: targetDir });

    expect(result).toEqual({ directory: targetDir });
    expect(await readFile(path.join(targetDir, 'insomnia.wrk_a.yaml'))).toBe('name: A\n');
  });

  it('rejects moving onto the folder already connected to another project', async () => {
    const currentDir = path.join(parentDir, 'current');
    await fs.promises.mkdir(currentDir, { recursive: true });
    const otherDir = path.join(parentDir, 'other-project-dir');
    await fs.promises.mkdir(otherDir, { recursive: true });
    await services.gitRepository.create({ uri: 'https://example.com/other.git', directory: otherDir });

    const repo = await services.gitRepository.create({ uri: 'https://example.com/foo.git', directory: currentDir });

    const result = await relocateGitRepoAction({ gitRepositoryId: repo._id, projectId: PROJECT_ID, newDirectory: otherDir });

    expect(result.errors?.[0]).toContain('A project is already connected to this folder');
  });

  it('treats picking the same, still-available folder as a no-op error', async () => {
    const currentDir = path.join(parentDir, 'current');
    await fs.promises.mkdir(currentDir, { recursive: true });

    const repo = await services.gitRepository.create({ uri: 'https://example.com/foo.git', directory: currentDir });

    const result = await relocateGitRepoAction({ gitRepositoryId: repo._id, projectId: PROJECT_ID, newDirectory: currentDir });

    expect(result.errors?.[0]).toBe('The repository is already in that folder.');
  });

  // Regression: previously, picking the same PARENT the recovery flow computed
  // from a stale, no-longer-existing `directory` always hit the "already in
  // that folder" short-circuit and refused — even though nothing was actually
  // there. It must fall through to the normal (adopt/move) handling instead.
  it('falls through instead of refusing when the same path is picked but is no longer on disk', async () => {
    const currentDir = path.join(parentDir, 'gone'); // never created — simulates an external rename/delete
    const repo = await services.gitRepository.create({ uri: 'https://example.com/foo.git', directory: currentDir });

    const result = await relocateGitRepoAction({ gitRepositoryId: repo._id, projectId: PROJECT_ID, newDirectory: currentDir });

    expect(result).toEqual({ directory: currentDir });
    const recreated = await fs.promises
      .access(currentDir)
      .then(() => true)
      .catch(() => false);
    expect(recreated).toBe(true);
  });
});
