import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { configureStore } from '../store/current-store';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { VCS } from '../vcs';

// `a/b` is stored as `branches/a~b.json`. The server allows `~` in branch names, so `a~b` is a
// server-accepted name. Read and remove paths use only encodeBranchName (no validator), so they must
// not resolve `a~b` to the file of `a/b`. Writes are unaffected because validateBranchName rejects `~`.

const now = () => new Date();

describe('branch read/remove paths for server-accepted names that alias another branch', () => {
  let root: string;
  let storeDir: string;
  let vcs: VCS;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vcs-branch-alias-'));
    const dataDir = path.join(root, 'data');
    storeDir = path.join(dataDir, 'version-control');
    configureStore(FileSystemDriver.create(dataDir));
    vcs = new VCS({ workspaceId: 'workspace_1' });
    await vcs.switchAndCreateBackendProjectIfNotExist('workspace_1', 'Test Workspace');
    await vcs._storeBranch({ name: 'a/b', created: now(), modified: now(), snapshots: [] });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('control: the real branch a/b is readable and removable by its own name', async () => {
    expect((await vcs._getBranch('a/b'))?.name).toBe('a/b');
    await vcs._removeBranch({ name: 'a/b', created: now(), modified: now(), snapshots: [] });
    expect(await vcs._getBranch('a/b')).toBeNull();
  });

  it('_getBranch("a~b") must not return the branch a/b', async () => {
    expect(await vcs._getBranch('a~b')).toBeNull();
  });

  it('_removeBranch({name:"a~b"}) must not delete the local record of a/b', async () => {
    await vcs._removeBranch({ name: 'a~b', created: now(), modified: now(), snapshots: [] }).catch(() => {});
    expect((await vcs._getBranch('a/b'))?.name).toBe('a/b');
  });

  it.each(['a:b', 'a*b', 'a?b'])('_getBranch(%j) with no such branch returns null and reads nothing outside the store', async name => {
    expect(await vcs._getBranch(name)).toBeNull();
    const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
    const outside = entries
      .filter(e => e.isFile())
      .map(e => path.join(e.parentPath, e.name))
      .filter(p => !p.startsWith(storeDir + path.sep));
    expect(outside).toEqual([]);
  });
});
