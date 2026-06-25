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
