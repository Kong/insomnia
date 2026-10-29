import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getBackendProjectById, removeProject, storeBackendProject } from '../backend-projects';
import { configureStore } from '../store/current-store';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { VCS } from '../vcs';

vi.mock('../session', () => ({
  assertSession: vi.fn(),
  runGraphQL: vi.fn(async () => {
    throw new Error('network must not be reached for an invalid id');
  }),
}));

const VALID_SNAPSHOT_ID = 'b'.repeat(40);

const maliciousSnapshotIds: Record<string, string> = {
  'parent traversal': '../../../../../../ESCAPED_PROOF',
  'absolute path': '/tmp/ESCAPED_PROOF',
  'backslash traversal': '..\\..\\..\\..\\..\\ESCAPED_PROOF',
  'NUL byte': 'ab\0/../../../../../ESCAPED_PROOF',
  uppercase: 'B'.repeat(40),
  'wrong length': 'abcd',
};

const maliciousProjectIds: Record<string, string> = {
  'parent traversal': '../../../../../ESCAPED_PROOF',
  'nested path': 'prj_a/../../ESCAPED_PROOF',
  'absolute path': '/tmp/ESCAPED_PROOF',
  'backslash traversal': '..\\..\\..\\ESCAPED_PROOF',
  'NUL byte': 'prj_a\0/../../ESCAPED_PROOF',
  'empty': '',
  'dot-dot': '..',
};

describe('cloud sync store key id containment', () => {
  let root: string;
  let storeDir: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vcs-id-containment-'));
    const dataDir = path.join(root, 'data');
    storeDir = path.join(dataDir, 'version-control');
    configureStore(FileSystemDriver.create(dataDir));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  async function filesOutsideStore() {
    const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
    return entries
      .filter(e => e.isFile())
      .map(e => path.join(e.parentPath, e.name))
      .filter(p => !p.startsWith(storeDir + path.sep));
  }

  describe('snapshot ids', () => {
    let vcs: VCS;

    beforeEach(async () => {
      vcs = new VCS({ workspaceId: 'workspace_1' });
      await vcs.switchAndCreateBackendProjectIfNotExist('workspace_1', 'Test Workspace');
    });

    it('stores a well-formed snapshot id', async () => {
      const snapshot: any = { id: VALID_SNAPSHOT_ID, created: new Date(), parent: '', state: [] };
      await vcs._storeSnapshots([snapshot]);
      expect((await vcs._getSnapshot(VALID_SNAPSHOT_ID))?.id).toBe(VALID_SNAPSHOT_ID);
      expect(await filesOutsideStore()).toEqual([]);
    });

    describe.each(Object.entries(maliciousSnapshotIds))('%s', (_label, id) => {
      const snapshot: any = { created: new Date(), parent: '', state: [] };

      it('_storeSnapshots rejects and writes nothing outside the store', async () => {
        await expect(vcs._storeSnapshots([{ ...snapshot, id }])).rejects.toThrow();
        expect(await filesOutsideStore()).toEqual([]);
      });

      it('_storeSnapshot rejects and writes nothing outside the store', async () => {
        await expect(vcs._storeSnapshot({ ...snapshot, id })).rejects.toThrow();
        expect(await filesOutsideStore()).toEqual([]);
      });

      it('_assertSnapshot rejects', async () => {
        await expect(vcs._assertSnapshot(id)).rejects.toThrow();
      });

      it('_getSnapshot does not look the id up', async () => {
        expect(await vcs._getSnapshot(id)).toBeNull();
      });
    });
  });

  describe('backend project ids', () => {
    it('stores a well-formed project id', async () => {
      const project = { id: 'prj_0123456789abcdef0123456789abcdef', name: 'n', rootDocumentId: 'wrk_1' };
      await storeBackendProject(project);
      expect(await getBackendProjectById(project.id)).toEqual(project);
      await removeProject(project);
    });

    describe.each(Object.entries(maliciousProjectIds))('%s', (_label, id) => {
      const project = { id, name: 'n', rootDocumentId: 'wrk_1' };

      it('storeBackendProject rejects and writes nothing outside the store', async () => {
        await expect(storeBackendProject(project)).rejects.toThrow();
        expect(await filesOutsideStore()).toEqual([]);
      });

      it('setBackendProject rejects and writes nothing outside the store', async () => {
        const vcs = new VCS({ workspaceId: 'workspace_1' });
        await expect(vcs.setBackendProject(project)).rejects.toThrow();
        expect(vcs.hasBackendProject()).toBe(false);
        expect(await filesOutsideStore()).toEqual([]);
      });

      it('getBackendProjectById / removeProject reject', async () => {
        await expect(getBackendProjectById(id)).rejects.toThrow();
        await expect(removeProject(project)).rejects.toThrow();
      });
    });
  });
});
