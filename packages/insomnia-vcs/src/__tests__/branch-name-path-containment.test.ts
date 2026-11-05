import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { configureStore } from '../store/current-store';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { VCS } from '../vcs';

// Branch names can arrive from a sync peer. Writes are already restricted by
// VCS.validateBranchName; lookups and removals must be just as strict.
const hostileBranchNames: Record<string, string> = {
  'parent traversal': '../../../../ESCAPED_PROOF',
  'backslash traversal': '..\\..\\..\\..\\ESCAPED_PROOF',
  'NUL byte': 'main\0/../../ESCAPED_PROOF',
  'bare dot-dot': '..',
  'dot-dot segment': 'feature/../../ESCAPED_PROOF',
  'bare backslash': 'a\\b',
};

const legitBranchNames = ['main', 'feature/login', 'fix/a/b/c', 'v1.2.3', 'my_branch-2'];

describe('cloud sync branch name path containment', () => {
  let root: string;
  let storeDir: string;
  let vcs: VCS;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vcs-branch-containment-'));
    const dataDir = path.join(root, 'data');
    storeDir = path.join(dataDir, 'version-control');
    configureStore(FileSystemDriver.create(dataDir));
    vcs = new VCS({ workspaceId: 'workspace_1' });
    await vcs.switchAndCreateBackendProjectIfNotExist('workspace_1', 'Test Workspace');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  describe.each(legitBranchNames)('legit branch name %j', name => {
    it('round-trips through the store and can be removed', async () => {
      const now = new Date();
      await vcs._storeBranch({ name, created: now, modified: now, snapshots: [] });
      expect((await vcs._getBranch(name.toLowerCase()))?.name).toBe(name);
      await vcs._removeBranch({ name: name.toLowerCase(), created: now, modified: now, snapshots: [] });
      expect(await vcs._getBranch(name)).toBeNull();
    });
  });

  describe.each(Object.entries(hostileBranchNames))('%s', (_label, name) => {
    const branch = { name, created: new Date(), modified: new Date(), snapshots: [] };

    it('_storeBranch rejects and writes nothing outside the store', async () => {
      await expect(vcs._storeBranch({ ...branch })).rejects.toThrow();
      const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
      const outside = entries
        .filter(e => e.isFile())
        .map(e => path.join(e.parentPath, e.name))
        .filter(p => !p.startsWith(storeDir + path.sep));
      expect(outside).toEqual([]);
    });

    it('_getBranch rejects instead of reading a path derived from the name', async () => {
      await expect(vcs._getBranch(name)).rejects.toThrow();
    });

    it('_removeBranch rejects instead of removing a path derived from the name', async () => {
      await expect(vcs._removeBranch({ ...branch })).rejects.toThrow();
    });
  });
});
