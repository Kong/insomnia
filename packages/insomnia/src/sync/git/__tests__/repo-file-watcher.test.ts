import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { database as db } from '../../../common/database';
import { RepoFileWatcherRegistry } from '../repo-file-watcher';

vi.mock('../../../common/insomnia-v5', () => ({
  getInsomniaV5DataExport: vi.fn().mockResolvedValue('type: collection.insomnia.rest/5.0\nname: Preserved\n'),
  tryImportV5Data: vi.fn().mockReturnValue({ data: undefined, error: undefined }),
}));

const REPO_ID = 'git_repo_test';
const PROJECT_ID = 'proj_test';

const makeRegistry = () =>
  new RepoFileWatcherRegistry({
    onDbSynced: vi.fn(),
    onProblemsChanged: vi.fn(),
  });

const createWorkspaceWithMeta = async (gitFilePath: string, gitFileLastSyncTime: number | null) => {
  const workspace = await services.workspace.create({
    name: 'My Collection',
    scope: 'collection',
    parentId: PROJECT_ID,
  });
  const meta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);
  await services.workspaceMeta.update(meta, { gitFilePath, gitFileLastSyncTime });
  return workspace;
};

describe('RepoFileWatcher orphan reconciliation', () => {
  let repoDir: string;
  let registry: RepoFileWatcherRegistry;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    repoDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-repo-watcher-'));
    registry = makeRegistry();
  });

  afterEach(async () => {
    registry.stopAll();
    await fs.promises.rm(repoDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  // Regression for the Git Sync data-loss bug: connecting an empty repo to a
  // project that already has local data must NOT delete that data.
  it('preserves a never-synced workspace whose YAML is absent from disk', async () => {
    const workspace = await createWorkspaceWithMeta('insomnia.wrk_local.yaml', null);

    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    // Workspace must still exist in the DB.
    const stillThere = await services.workspace.getById(workspace._id);
    expect(stillThere).not.toBeNull();

    // And it must have been written to disk so the user can commit it.
    const written = await fs.promises
      .access(path.join(repoDir, 'insomnia.wrk_local.yaml'))
      .then(() => true)
      .catch(() => false);
    expect(written).toBe(true);
  });

  it('removes a previously-synced workspace whose YAML was deleted on the remote', async () => {
    const workspace = await createWorkspaceWithMeta('insomnia.wrk_synced.yaml', Date.now());

    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    const removed = await services.workspace.getById(workspace._id);
    expect(removed).toBeFalsy();
  });

  it('keeps a workspace whose YAML is present on disk', async () => {
    const workspace = await createWorkspaceWithMeta('insomnia.wrk_present.yaml', Date.now());
    await fs.promises.writeFile(path.join(repoDir, 'insomnia.wrk_present.yaml'), 'name: Present\n', 'utf8');

    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    const stillThere = await services.workspace.getById(workspace._id);
    expect(stillThere).not.toBeNull();
  });
});

describe('RepoFileWatcher ruleset import problems', () => {
  let repoDir: string;
  let registry: RepoFileWatcherRegistry;
  const RULESET_PATH = '.spectral.yaml';
  const VALID_RULESET = 'extends:\n  - "spectral:oas"\nrules: {}\n';
  const INVALID_RULESET = 'rules:\n  - [unclosed';

  const getRulesetImportIssue = (repoId: string) =>
    registry.getProblems(repoId).find(problem => problem.relPath === RULESET_PATH) ?? null;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    repoDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-repo-watcher-ruleset-'));
    registry = makeRegistry();
  });

  afterEach(async () => {
    registry.stopAll();
    await fs.promises.rm(repoDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('surfaces the .spectral.yaml problem when invalid and clears it once fixed', async () => {
    const absPath = path.join(repoDir, RULESET_PATH);

    // Invalid → issue surfaced.
    await fs.promises.writeFile(absPath, INVALID_RULESET, 'utf8');
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);
    expect(getRulesetImportIssue(REPO_ID)).toMatchObject({ kind: 'parse-error', relPath: RULESET_PATH });

    // Fixed → issue cleared.
    await fs.promises.writeFile(absPath, VALID_RULESET, 'utf8');
    await registry.importAllFiles(REPO_ID);
    expect(getRulesetImportIssue(REPO_ID)).toBeNull();
  });

  it('returns null when the ruleset is valid', async () => {
    await fs.promises.writeFile(path.join(repoDir, RULESET_PATH), VALID_RULESET, 'utf8');
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);
    expect(getRulesetImportIssue(REPO_ID)).toBeNull();
  });

  it('returns null when the watcher is not running', () => {
    expect(getRulesetImportIssue('nonexistent_repo')).toBeNull();
  });

  // Regression: uploading a valid ruleset over a previously-invalid committed
  // file must clear the stale problem, so the spec page stops showing
  // "Invalid ruleset — using default".
  it('clears a stale ruleset problem after a valid ruleset is stored via upload', async () => {
    const absPath = path.join(repoDir, RULESET_PATH);
    await fs.promises.writeFile(absPath, INVALID_RULESET, 'utf8');
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);
    expect(getRulesetImportIssue(REPO_ID)).not.toBeNull();

    // Simulate a UI upload: valid ruleset upserted to the DB, then flushed to disk.
    await services.projectLintRuleset.upsert(PROJECT_ID, { rulesetContent: VALID_RULESET });
    await registry.flushNow(REPO_ID);

    expect(getRulesetImportIssue(REPO_ID)).toBeNull();
  });

  // Regression: cloning a repo whose committed .spectral.yaml is invalid must
  // never delete the file. Previously, an invalid ruleset was silently
  // ignored (not recognized as a ruleset at all) instead of being rejected,
  // so nothing prevented the file from later being deleted as a stale
  // tracked file — which git staged as a deletion that Discard could never
  // resolve, since re-importing the same invalid content each time was also
  // a silent no-op.
  it('keeps an invalid cloned ruleset on disk and out of the DB, surviving repeated re-imports', async () => {
    const absPath = path.join(repoDir, RULESET_PATH);
    await fs.promises.writeFile(absPath, INVALID_RULESET, 'utf8');

    // Simulate the initial clone import.
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    const exists = () => fs.promises.access(absPath).then(() => true).catch(() => false);
    expect(await exists()).toBe(true);
    expect(await services.projectLintRuleset.getByParentId(PROJECT_ID)).toBeFalsy();
    expect(getRulesetImportIssue(REPO_ID)).not.toBeNull();

    // Simulate a Discard, which re-writes the same invalid content (as if
    // restored from git HEAD), followed by the resulting re-import.
    await fs.promises.writeFile(absPath, INVALID_RULESET, 'utf8');
    await registry.importAllFiles(REPO_ID);
    await registry.flushNow(REPO_ID);

    expect(await exists()).toBe(true);
    expect(await services.projectLintRuleset.getByParentId(PROJECT_ID)).toBeFalsy();
    expect(getRulesetImportIssue(REPO_ID)).not.toBeNull();
  });
});
