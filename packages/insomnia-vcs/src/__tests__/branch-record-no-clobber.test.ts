import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureStore, getStore } from '../store/current-store';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { VCS } from '../vcs';

const now = () => new Date();

describe('branch records are never overwritten by a different branch name', () => {
  let root: string;
  let vcs: VCS;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vcs-no-clobber-'));
    configureStore(FileSystemDriver.create(path.join(root, 'data')));
    vcs = new VCS({ workspaceId: 'workspace_1' });
    await vcs.switchAndCreateBackendProjectIfNotExist('workspace_1', 'Test Workspace');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('a legacy a~b record is not replaced by creating a/b', async () => {
    const key = `/projects/${vcs._backendProjectId()}/branches/a~b.json`;
    await getStore().setItem(key, { name: 'a~b', created: now(), modified: now(), snapshots: ['s1'] });
    await expect(vcs._getOrCreateBranch('a/b')).rejects.toThrow('conflicts');
    expect(((await getStore().getItem(key)) as { snapshots: string[] }).snapshots).toEqual(['s1']);
  });

  it('Foo is not replaced by creating foo', async () => {
    await vcs._storeBranch({ name: 'Foo', created: now(), modified: now(), snapshots: ['s1'] });
    await expect(vcs._storeBranch({ name: 'foo', created: now(), modified: now(), snapshots: [] })).rejects.toThrow(
      'conflicts',
    );
  });

  it('pull refuses when a user branch holds the temp name', async () => {
    await vcs._storeBranch({ name: 'pull-tmp.hidden', created: now(), modified: now(), snapshots: ['s1'] });
    vi.spyOn(vcs, '_getOrCreateRemoteBackendProject').mockResolvedValue(undefined as never);
    const fetchSpy = vi.spyOn(vcs, 'customFetch');
    await expect(vcs.pull({ candidates: [], teamId: 't', teamProjectId: 'p', projectId: 'x' })).rejects.toThrow(
      'pull-tmp.hidden',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await vcs._getBranch('pull-tmp.hidden'))?.snapshots).toEqual(['s1']);
  });
});
