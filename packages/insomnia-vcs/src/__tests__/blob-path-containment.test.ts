import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { configureStore } from '../store/current-store';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { VCS } from '../vcs';

const VALID_BLOB_ID = 'a'.repeat(40);

// Ids that a malicious sync server could return. None may cause a write outside the store.
const maliciousBlobIds: Record<string, string> = {
  'parent traversal': 'zz/../../../../../../ESCAPED_PROOF.txt',
  'parent traversal without prefix': '../../../../../../ESCAPED_PROOF.txt',
  'absolute path': '/tmp/ESCAPED_PROOF.txt',
  'backslash traversal': 'zz\\..\\..\\..\\..\\..\\..\\ESCAPED_PROOF.txt',
  'NUL byte': 'ab\0/../../../../../../ESCAPED_PROOF.txt',
  'non-hex characters': 'z'.repeat(40),
  'too short': 'abcd',
  'too long': 'a'.repeat(41),
  'empty': '',
};

describe('cloud sync blob id path containment', () => {
  let root: string;
  let storeDir: string;
  let vcs: VCS;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vcs-blob-containment-'));
    const dataDir = path.join(root, 'data');
    storeDir = path.join(dataDir, 'version-control');
    configureStore(FileSystemDriver.create(dataDir));
    vcs = new VCS({ workspaceId: 'workspace_1' });
    await vcs.switchAndCreateBackendProjectIfNotExist('workspace_1', 'Test Workspace');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  // Every file under `root` must live inside the store directory.
  async function filesOutsideStore() {
    const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
    return entries
      .filter(e => e.isFile())
      .map(e => path.join(e.parentPath, e.name))
      .filter(p => !p.startsWith(storeDir + path.sep));
  }

  it('stores a well-formed blob id inside the store', async () => {
    await vcs._storeBlobsBuffer({ [VALID_BLOB_ID]: Buffer.from('X') });
    expect(await vcs._hasBlob(VALID_BLOB_ID)).toBe(true);
    expect((await vcs._getBlobRaw(VALID_BLOB_ID))?.toString()).toBe('X');
    expect(await filesOutsideStore()).toEqual([]);
  });

  describe.each(Object.entries(maliciousBlobIds))('%s', (_label, blobId) => {
    it('_storeBlobsBuffer rejects and writes nothing outside the store', async () => {
      await expect(vcs._storeBlobsBuffer({ [blobId]: Buffer.from('X') })).rejects.toThrow();
      expect(await filesOutsideStore()).toEqual([]);
    });

    it('_storeBlobs rejects and writes nothing outside the store', async () => {
      await expect(vcs._storeBlobs({ [blobId]: 'X' })).rejects.toThrow();
      expect(await filesOutsideStore()).toEqual([]);
    });

    it('_storeBlob rejects and writes nothing outside the store', async () => {
      await expect(vcs._storeBlob(blobId, { a: 1 })).rejects.toThrow();
      expect(await filesOutsideStore()).toEqual([]);
    });

    it('read helpers reject', async () => {
      await expect(vcs._getBlobRaw(blobId)).rejects.toThrow();
      await expect(vcs._hasBlob(blobId)).rejects.toThrow();
      await expect(vcs._getBlob(blobId)).rejects.toThrow();
    });
  });
});
