import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureStore } from '../store/current-store';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { VCS } from '../vcs';

// The sync server validates snapshot and blob ids as `[0-9a-z]{40}`. The client requires sha1 hex
// (`[0-9a-f]{40}`). An id such as 'z'*40 is therefore accepted and persisted by the server, and every
// client must fail the fetch on it. The client is fail-closed here: it throws before any branch
// or snapshot is written. The DoS is the server's contract mismatch, not a client write bug.

const VALID_ID = 'b'.repeat(40);
const SERVER_ACCEPTED_NON_HEX_ID = 'z'.repeat(40);

describe('customFetch with server-accepted non-hex object ids', () => {
  let root: string;
  let storeDir: string;
  let vcs: VCS;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vcs-nonhex-id-'));
    const dataDir = path.join(root, 'data');
    storeDir = path.join(dataDir, 'version-control');
    configureStore(FileSystemDriver.create(dataDir));
    vcs = new VCS({ workspaceId: 'workspace_1' });
    await vcs.switchAndCreateBackendProjectIfNotExist('workspace_1', 'Test Workspace');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  function mockRemote(snapshotId: string, blobId: string) {
    const now = new Date();
    vi.spyOn(vcs, '_queryBranch').mockResolvedValue({ name: 'main', created: now, modified: now, snapshots: [snapshotId] });
    vi.spyOn(vcs, '_querySnapshots').mockResolvedValue([
      {
        id: snapshotId,
        created: now,
        parent: '',
        author: 'remote',
        name: 'remote snapshot',
        description: '',
        state: [{ key: 'wrk_ok', blob: blobId, name: 'x' }],
      },
    ] as any);
    vi.spyOn(vcs, '_queryBlobs').mockResolvedValue({ [blobId]: Buffer.from('{}') } as any);
  }

  async function filesOutsideStore() {
    const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
    return entries
      .filter(e => e.isFile())
      .map(e => path.join(e.parentPath, e.name))
      .filter(p => !p.startsWith(storeDir + path.sep));
  }

  it('control: all-hex ids fetch and store the branch', async () => {
    mockRemote(VALID_ID, VALID_ID);
    await expect(vcs.customFetch('feature/ok', 'main')).resolves.toBeTruthy();
    expect(await vcs._getBranch('feature/ok')).not.toBeNull();
  });

  it('server-accepted non-hex snapshot id: fetch throws and writes nothing', async () => {
    mockRemote(SERVER_ACCEPTED_NON_HEX_ID, VALID_ID);
    await expect(vcs.customFetch('feature/bad-snap', 'main')).rejects.toThrow('Invalid snapshot id');
    expect(await vcs._getBranch('feature/bad-snap')).toBeNull();
    // Nothing is cached, so the same remote state fails again on the next pull (persistent DoS).
    await expect(vcs.customFetch('feature/bad-snap', 'main')).rejects.toThrow('Invalid snapshot id');
    expect(await filesOutsideStore()).toEqual([]);
  });

  it('server-accepted non-hex blob id: fetch throws and writes nothing', async () => {
    mockRemote(VALID_ID, SERVER_ACCEPTED_NON_HEX_ID);
    await expect(vcs.customFetch('feature/bad-blob', 'main')).rejects.toThrow('Invalid blob id');
    expect(await vcs._getBranch('feature/bad-blob')).toBeNull();
    expect(await filesOutsideStore()).toEqual([]);
  });
});
