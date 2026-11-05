import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureStore } from '../store/current-store';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { VCS } from '../vcs';

// Snapshot and blob ids are 40 lowercase alphanumeric characters (`[0-9a-z]{40}`), not only sha1 hex.
// An id such as 'z'*40 must be accepted so a pull never fails permanently on it, while anything that
// could change path resolution must stay rejected and never write outside the store directory.

const VALID_ID = 'b'.repeat(40);
const NON_HEX_ID = 'z'.repeat(40);

const hostileIds: Record<string, string> = {
  uppercase: 'B'.repeat(40),
  'mixed case': 'aB'.repeat(20),
  '39 chars': 'z'.repeat(39),
  '41 chars': 'z'.repeat(41),
  'parent traversal': '../../../../../../ESCAPED_PROOF',
  'traversal padded to 40': ('../' + 'z'.repeat(40)).slice(0, 40),
  slash: 'z'.repeat(19) + '/' + 'z'.repeat(20),
  backslash: 'z'.repeat(19) + '\\' + 'z'.repeat(20),
  dot: 'z'.repeat(19) + '.' + 'z'.repeat(20),
  NUL: 'z'.repeat(19) + '\0' + 'z'.repeat(20),
  tilde: 'z'.repeat(19) + '~' + 'z'.repeat(20),
  colon: 'z'.repeat(19) + ':' + 'z'.repeat(20),
  space: 'z'.repeat(19) + ' ' + 'z'.repeat(20),
  newline: 'z'.repeat(19) + '\n' + 'z'.repeat(20),
  unicode: 'z'.repeat(19) + '\u00E9' + 'z'.repeat(20),
  empty: '',
};

describe('customFetch with non-hex lowercase alphanumeric object ids', () => {
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

  it('non-hex snapshot id: fetch succeeds and stays inside the store', async () => {
    mockRemote(NON_HEX_ID, VALID_ID);
    await expect(vcs.customFetch('feature/z-snap', 'main')).resolves.toBeTruthy();
    expect(await vcs._getBranch('feature/z-snap')).not.toBeNull();
    expect(await vcs._getSnapshot(NON_HEX_ID)).not.toBeNull();
    // Repeat pulls keep working
    await expect(vcs.customFetch('feature/z-snap', 'main')).resolves.toBeTruthy();
    expect(await filesOutsideStore()).toEqual([]);
  });

  it('non-hex blob id: fetch succeeds and stays inside the store', async () => {
    mockRemote(VALID_ID, NON_HEX_ID);
    await expect(vcs.customFetch('feature/z-blob', 'main')).resolves.toBeTruthy();
    expect(await vcs._hasBlob(NON_HEX_ID)).toBe(true);
    expect(await filesOutsideStore()).toEqual([]);
  });

  describe.each(Object.entries(hostileIds))('hostile id: %s', (_label, id) => {
    it('snapshot id is rejected by fetch and nothing is written outside the store', async () => {
      mockRemote(id, VALID_ID);
      await expect(vcs.customFetch('feature/hostile-snap', 'main')).rejects.toThrow('Invalid snapshot id');
      expect(await vcs._getBranch('feature/hostile-snap')).toBeNull();
      expect(await filesOutsideStore()).toEqual([]);
    });

    it('blob id is rejected by fetch and by direct stores, nothing is written outside the store', async () => {
      mockRemote(VALID_ID, id);
      await expect(vcs.customFetch('feature/hostile-blob', 'main')).rejects.toThrow('Invalid blob id');
      expect(await vcs._getBranch('feature/hostile-blob')).toBeNull();
      await expect(vcs._storeBlobsBuffer({ [id]: Buffer.from('X') })).rejects.toThrow('Invalid blob id');
      expect(await filesOutsideStore()).toEqual([]);
    });
  });
});
