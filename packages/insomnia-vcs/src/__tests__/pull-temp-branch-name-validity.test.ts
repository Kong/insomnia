import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureStore } from '../store/current-store';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { VCS } from '../vcs';

// pull() fetches the remote into a temp branch that goes through validateBranchName in customFetch,
// so the temp name must be valid even when the local branch name sits at the validator's limits.

describe('pull() temp branch name', () => {
  let root: string;
  let vcs: VCS;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vcs-pull-tmp-'));
    configureStore(FileSystemDriver.create(path.join(root, 'data')));
    vcs = new VCS({ workspaceId: 'workspace_1' });
    await vcs.switchAndCreateBackendProjectIfNotExist('workspace_1', 'Test Workspace');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('is valid when the local branch name is near the length cap', async () => {
    const name = 'a'.repeat(199);
    expect(VCS.validateBranchName(name)).toBe('');
    await vcs._storeBranch({ name, created: new Date(), modified: new Date(), snapshots: [] });
    await vcs._storeHead({ branch: name });
    vi.spyOn(vcs, '_getOrCreateRemoteBackendProject').mockResolvedValue(undefined as never);
    const fetchSpy = vi.spyOn(vcs, 'customFetch').mockRejectedValue(new Error('stop'));

    await vcs.pull({ candidates: [], teamId: 't', teamProjectId: 'p', projectId: 'proj' }).catch(() => {});

    expect(fetchSpy).toHaveBeenCalledWith(expect.any(String), name);
    const tmpName = fetchSpy.mock.calls[0][0];
    expect(VCS.validateBranchName(tmpName)).toBe('');
  });
});
