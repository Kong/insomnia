import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { configureStore, getStore } from '../store/current-store';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { VCS } from '../vcs';

// Control for the reserved-device-name case: on macOS/Linux these names are ordinary file names,
// so a store round-trip must succeed and the file must land inside the store directory. This
// documents that the Windows-only failure is not reproducible on this host.

describe('reserved device names round-trip on a POSIX file system (control)', () => {
  let root: string;
  let storeDir: string;
  let vcs: VCS;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vcs-reserved-names-'));
    const dataDir = path.join(root, 'data');
    storeDir = path.join(dataDir, 'version-control');
    configureStore(FileSystemDriver.create(dataDir));
    vcs = new VCS({ workspaceId: 'workspace_1' });
    await vcs.switchAndCreateBackendProjectIfNotExist('workspace_1', 'Test Workspace');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it.skipIf(process.platform === 'win32')('nul and con store and read back inside the store dir', async () => {
    for (const name of ['nul', 'con']) {
      // validateBranchName now rejects these names, so exercise the store directly
      const key = `/projects/${vcs._backendProjectId()}/branches/${name}.json`;
      await getStore().setItem(key, { name });
      expect(((await getStore().getItem(key)) as { name: string }).name).toBe(name);
    }
    const files = await fs.readdir(storeDir, { recursive: true, withFileTypes: true });
    const outside = files
      .filter(e => e.isFile())
      .map(e => path.join(e.parentPath, e.name))
      .filter(p => !p.startsWith(storeDir + path.sep));
    expect(outside).toEqual([]);
  });
});
