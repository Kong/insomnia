import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { configureStore, getStore } from '../store/current-store';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { VCS } from '../vcs';

// Branch records written before validateBranchName tightened (e.g. `aux`, 200+ char names) must stay
// readable and removable, otherwise every VCS operation on a workspace whose head is on one fails.

describe('branch records whose names the validator now rejects', () => {
  let root: string;
  let vcs: VCS;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vcs-legacy-branch-'));
    configureStore(FileSystemDriver.create(path.join(root, 'data')));
    vcs = new VCS({ workspaceId: 'workspace_1' });
    await vcs.switchAndCreateBackendProjectIfNotExist('workspace_1', 'Test Workspace');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const writeLegacy = (name: string) =>
    getStore().setItem(`/projects/${vcs._backendProjectId()}/branches/${name.replaceAll('/', '~')}.json`, {
      name,
      created: new Date(),
      modified: new Date(),
      snapshots: [],
    });

  it.each(['aux', 'con', `a${'b'.repeat(204)}`])('reads and removes %#', async name => {
    expect(VCS.validateBranchName(name)).not.toBe('');
    await writeLegacy(name);
    expect((await vcs._getBranch(name))?.name).toBe(name);
    expect((await vcs._getOrCreateBranch(name)).name).toBe(name);
    await vcs._removeBranch({ name, created: new Date(), modified: new Date(), snapshots: [] });
    expect(await vcs._getBranch(name)).toBeNull();
  });

  it('does not return a record stored under a different name', async () => {
    await writeLegacy('a/b');
    expect(await vcs._getBranch('a~b')).toBeNull();
  });

  it('still rejects traversal names', async () => {
    await expect(vcs._getBranch('../x')).rejects.toThrow('Invalid branch name');
  });
});
