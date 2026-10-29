import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureStore } from '../store/current-store';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { VCS } from '../vcs';

// Branch names can be up to 256 bytes. The on-disk file is `<name>.json` (+5 bytes,
// so any name over 250 bytes cannot be stored at all) and the atomic-write temp file is
// `<name>.json.<uuid>.tmp` (+46 bytes, so names over ~209 bytes fail at write time). A fetch of such a
// branch must not leave snapshots stored without the branch that references them.

const REMOTE_SNAPSHOT_ID = 'b'.repeat(40);

describe('customFetch with long branch names stays all-or-nothing', () => {
  let root: string;
  let vcs: VCS;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vcs-branch-maxlen-'));
    configureStore(FileSystemDriver.create(path.join(root, 'data')));
    vcs = new VCS({ workspaceId: 'workspace_1' });
    await vcs.switchAndCreateBackendProjectIfNotExist('workspace_1', 'Test Workspace');

    const now = new Date();
    vi.spyOn(vcs, '_queryBranch').mockResolvedValue({
      name: 'main',
      created: now,
      modified: now,
      snapshots: [REMOTE_SNAPSHOT_ID],
    });
    vi.spyOn(vcs, '_querySnapshots').mockResolvedValue([
      {
        id: REMOTE_SNAPSHOT_ID,
        created: now,
        parent: '',
        author: 'remote',
        name: 'remote snapshot',
        description: '',
        state: [],
      },
    ] as any);
    vi.spyOn(vcs, '_queryBlobs').mockResolvedValue({});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  async function fetchAndReport(localName: string) {
    const fetchError = await vcs.customFetch(localName, 'main').then(
      () => null,
      (err: Error) => err,
    );
    const snapshotStored = (await vcs._getSnapshot(REMOTE_SNAPSHOT_ID)) !== null;
    // Reading `<name>.json` itself throws ENAMETOOLONG for long names; that also means "not stored".
    const branchStored = await vcs._getBranch(localName).then(
      branch => branch !== null,
      () => false,
    );
    return { fetchError, snapshotStored, branchStored };
  }

  it('control: a short name stores the snapshot and the branch together', async () => {
    const result = await fetchAndReport('feature/short');
    expect(result.fetchError).toBeNull();
    expect(result.snapshotStored).toBe(true);
    expect(result.branchStored).toBe(true);
  });

  it('256-byte name: snapshot is not stored without its branch (no half-applied pull)', async () => {
    const longName = 'a'.repeat(256);
    const result = await fetchAndReport(longName);
    // Whatever the fix (accept the name, or reject it before any write), a failed fetch must leave
    // no snapshot behind that no branch refers to.
    expect(result.snapshotStored).toBe(result.branchStored);
  });
});
