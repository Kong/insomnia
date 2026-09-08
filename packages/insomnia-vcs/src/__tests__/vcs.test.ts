// @ts-nocheck
import { createBuilder } from '@develohpanda/fluent-builder';
import { models } from 'insomnia-data';
import { deterministicStringify } from 'insomnia-data/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { baseModelSchema, workspaceModelSchema } from '../__schemas__/model-schemas';
import { configureStore } from '../store/current-store';
import MemoryDriver from '../store/drivers/memory-driver';
import { hashDocument } from '../util';
import { chunkArray, VCS } from '../vcs';

const baseModelBuilder = createBuilder(baseModelSchema);
const workspaceModelBuilder = createBuilder(workspaceModelSchema);

function newDoc(id) {
  return baseModelBuilder.reset()._id(id).build();
}

async function vcs(branch) {
  configureStore(new MemoryDriver());
  const v = new VCS({ workspaceId: 'workspace_1' });
  await v.switchAndCreateBackendProjectIfNotExist('workspace_1', 'Test Workspace');
  await v.checkout([], branch);
  return v;
}

function describeChanges(a, b): string[] {
  const aT = Object.prototype.toString.call(a);
  const bT = Object.prototype.toString.call(b);

  if (aT !== '[object Object]' || bT !== '[object Object]') {
    return [];
  }

  const changes: string[] = [];
  const allKeys = Object.keys({ ...a, ...b });

  for (const key of allKeys) {
    if (models.shouldIgnoreKey(key, a)) {
      continue;
    }

    const aValue = a[key];
    const bValue = b[key];
    const aStr = deterministicStringify(aValue);
    const bStr = deterministicStringify(bValue);

    if (aValue === undefined && bValue !== undefined) {
      changes.push(`+${String(key)}`);
      continue;
    }

    if (aValue !== undefined && bValue === undefined) {
      changes.push(`-${String(key)}`);
      continue;
    }

    if (aStr !== bStr) {
      changes.push(key);
    }
  }

  return changes;
}

describe('VCS', () => {
  beforeEach(async () => {
    let ts = 1_000_000_000_000;
    Date.now = vi.fn(() => ts++);
  });

  describe('status()', () => {
    it('returns status with no commits', async () => {
      const v = await vcs('master');
      const status = await v.status([
        {
          key: 'foo',
          name: 'Foo',
          document: newDoc('bar'),
        },
        {
          key: 'baz',
          name: 'Baz',
          document: newDoc('qux'),
        },
      ]);
      expect(status).toEqual({
        stage: {},
        unstaged: {
          foo: {
            added: true,
            key: 'foo',
            blobContent: '{"_id":"bar","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            blobId: 'f084c7823f01300890d0d6539cfaffa5e2398da1',
            name: 'Foo',
            previousBlobContent: 'null',
          },
          baz: {
            added: true,
            key: 'baz',
            blobContent: '{"_id":"qux","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            blobId: 'aee296597cedfbfe6c961b0c48a5e05c6acb1da3',
            name: 'Baz',
            previousBlobContent: 'null',
          },
        },
      });
    });

    it('returns add/modify/delete operations', async () => {
      const v = await vcs('master');
      const status1 = await v.status(
        [
          {
            key: 'a',
            name: 'A',
            document: newDoc('aaa'),
          },
          {
            key: 'b',
            name: 'B',
            document: newDoc('bbb'),
          },
          {
            key: 'c',
            name: 'C',
            document: newDoc('ccc'),
          },
        ],
        {},
      );
      expect(Object.keys(status1.unstaged)).toEqual(['a', 'b', 'c']);
      await v.stage([status1.unstaged.a, status1.unstaged.b, status1.unstaged.c]);
      await v.takeSnapshot('Add a/b/c');
      const history = await v.getHistory();
      expect(history.length).toBe(1);
      expect(history).toEqual([
        {
          created: expect.any(Date),
          description: '',
          author: '',
          id: '9578a1809f33ba28620ca51369fe2f68e7a677fc',
          name: 'Add a/b/c',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
              key: 'a',
              name: 'A',
            },
            {
              blob: 'd42a1e9b61f31d85f54981d976aea411864c13c0',
              key: 'b',
              name: 'B',
            },
            {
              blob: 'c9b7e11ac4cc98b32962b059f6526e186d0a810a',
              key: 'c',
              name: 'C',
            },
          ],
        },
      ]);
      // Should get every operation type
      const status = await v.status(
        [
          {
            key: 'notA',
            name: 'Not A',
            document: newDoc('aaa'),
          },
          {
            key: 'b',
            name: 'B',
            document: newDoc('bbb'),
          },
          {
            key: 'c',
            name: 'C',
            document: newDoc('modified'),
          },
          {
            key: 'd',
            name: 'D',
            document: newDoc('ddd'),
          },
        ],
        {},
      );
      expect(status).toEqual({
        stage: {},
        unstaged: {
          a: {
            deleted: true,
            blobId: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
            key: 'a',
            name: 'A',
            previousBlobContent:
              '{\"_id\":\"aaa\",\"created\":1234,\"isPrivate\":false,\"name\":\"name\",\"parentId\":\"\",\"type\":\"base\"}',
          },
          notA: {
            added: true,
            key: 'notA',
            name: 'Not A',
            blobId: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
            blobContent: '{"_id":"aaa","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            previousBlobContent: 'null',
          },
          c: {
            modified: true,
            key: 'c',
            name: 'C',
            blobId: '87a13a793c6bc2137732ba4f8dc8d877fc143bad',
            blobContent:
              '{"_id":"modified","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            previousBlobContent:
              '{\"_id\":\"ccc\",\"created\":1234,\"isPrivate\":false,\"name\":\"name\",\"parentId\":\"\",\"type\":\"base\"}',
          },
          d: {
            added: true,
            key: 'd',
            name: 'D',
            blobId: 'cb6c7a2814104ff614133076245ae32fe9a62c8f',
            blobContent: '{"_id":"ddd","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            previousBlobContent: 'null',
          },
        },
      });
      await v.stage([status.unstaged.a, status.unstaged.notA, status.unstaged.c, status.unstaged.d]);
      const status2 = await v.status([
        {
          key: 'notA',
          name: 'Not A',
          document: newDoc('aaa'),
        },
        {
          key: 'b',
          name: 'B',
          document: newDoc('bbb'),
        },
        {
          key: 'c',
          name: 'C',
          document: newDoc('modified'),
        },
        {
          key: 'd',
          name: 'D',
          document: newDoc('ddd'),
        },
      ]);
      expect(status2).toEqual({
        stage: {
          a: {
            deleted: true,
            blobId: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
            key: 'a',
            name: 'A',
            previousBlobContent:
              '{\"_id\":\"aaa\",\"created\":1234,\"isPrivate\":false,\"name\":\"name\",\"parentId\":\"\",\"type\":\"base\"}',
          },
          notA: {
            added: true,
            blobId: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
            key: 'notA',
            name: 'Not A',
            blobContent: '{"_id":"aaa","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            previousBlobContent: 'null',
          },
          c: {
            modified: true,
            blobId: '87a13a793c6bc2137732ba4f8dc8d877fc143bad',
            key: 'c',
            name: 'C',
            blobContent:
              '{"_id":"modified","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            previousBlobContent:
              '{\"_id\":\"ccc\",\"created\":1234,\"isPrivate\":false,\"name\":\"name\",\"parentId\":\"\",\"type\":\"base\"}',
          },
          d: {
            added: true,
            blobId: 'cb6c7a2814104ff614133076245ae32fe9a62c8f',
            key: 'd',
            name: 'D',
            blobContent: '{"_id":"ddd","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            previousBlobContent: 'null',
          },
        },
        unstaged: {},
      });
    });

    it('can appear both staged and unstaged', async () => {
      const v = await vcs('master');
      const status = await v.status(
        [
          {
            key: 'a',
            name: 'A',
            document: newDoc('aaa'),
          },
          {
            key: 'b',
            name: 'B',
            document: newDoc('bbb'),
          },
        ],
        {},
      );
      await v.stage([status.unstaged.a]);
      const status2 = await v.status([
        {
          key: 'a',
          name: 'A',
          document: newDoc('modified'),
        },
        {
          key: 'b',
          name: 'B',
          document: newDoc('bbb'),
        },
      ]);
      expect(status2).toEqual({
        stage: {
          a: {
            added: true,
            blobId: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
            name: 'A',
            key: 'a',
            blobContent: '{"_id":"aaa","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            previousBlobContent: 'null',
          },
        },
        unstaged: {
          a: {
            modified: true,
            blobId: '87a13a793c6bc2137732ba4f8dc8d877fc143bad',
            key: 'a',
            name: 'A',
            blobContent:
              '{"_id":"modified","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            previousBlobContent:
              '{\"_id\":\"aaa\",\"created\":1234,\"isPrivate\":false,\"name\":\"name\",\"parentId\":\"\",\"type\":\"base\"}',
          },
          b: {
            added: true,
            blobId: 'd42a1e9b61f31d85f54981d976aea411864c13c0',
            name: 'B',
            key: 'b',
            blobContent: '{"_id":"bbb","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            previousBlobContent: 'null',
          },
        },
      });
    });

    it('should not show committed entities', async () => {
      const v = await vcs('master');
      const status = await v.status(
        [
          {
            key: 'foo',
            name: 'Foo',
            document: newDoc('bar'),
          },
        ],
        {},
      );
      await v.stage([status.unstaged.foo]);
      await v.takeSnapshot('Add foo');
      const status2 = await v.status(
        [
          {
            key: 'foo',
            name: 'Foo',
            document: newDoc('bar'),
          },
        ],
        {},
      );
      expect(status2).toEqual({
        stage: {},
        unstaged: {},
      });
    });
  });

  describe('stage()', () => {
    it('stages entity', async () => {
      const v = await vcs('master');
      const status = await v.status(
        [
          {
            key: 'foo',
            name: 'Foo',
            document: newDoc('bar'),
          },
          {
            key: 'baz',
            name: 'Baz',
            document: newDoc('qux'),
          },
        ],
        {},
      );
      const stage = await v.stage([status.unstaged.foo]);
      expect(stage).toEqual({
        foo: {
          key: 'foo',
          name: 'Foo',
          blobContent: '{"_id":"bar","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
          blobId: 'f084c7823f01300890d0d6539cfaffa5e2398da1',
          added: true,
          previousBlobContent: 'null',
        },
      });
      const status2 = await v.status([
        {
          key: 'foo',
          name: 'Foo',
          document: newDoc('bar'),
        },
        {
          key: 'baz',
          name: 'Baz',
          document: newDoc('qux'),
        },
      ]);
      expect(status2).toEqual({
        stage: {
          foo: {
            name: 'Foo',
            key: 'foo',
            blobContent: '{"_id":"bar","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            blobId: 'f084c7823f01300890d0d6539cfaffa5e2398da1',
            added: true,
            previousBlobContent: 'null',
          },
        },
        unstaged: {
          baz: {
            key: 'baz',
            name: 'Baz',
            blobContent: '{"_id":"qux","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            blobId: 'aee296597cedfbfe6c961b0c48a5e05c6acb1da3',
            added: true,
            previousBlobContent: 'null',
          },
        },
      });
    });
  });

  describe('takeSnapshot()', () => {
    it('commits basic entity', async () => {
      const v = await vcs('master');
      const status = await v.status(
        [
          {
            key: 'foo',
            name: 'Foo',
            document: newDoc('bar'),
          },
        ],
        {},
      );
      await v.stage([status.unstaged.foo]);
      await v.takeSnapshot('Add foo');
      const history = await v.getHistory();
      expect(history).toEqual([
        {
          id: '0cf92e06b012c7868eb132741505541a2ed251fa',
          author: '',
          created: expect.any(Date),
          name: 'Add foo',
          description: '',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: 'f084c7823f01300890d0d6539cfaffa5e2398da1',
              key: 'foo',
              name: 'Foo',
            },
          ],
        },
      ]);
    });

    it('commits deleted entity', async () => {
      const v = await vcs('master');
      const status = await v.status([
        {
          key: 'foo',
          name: 'Foo',
          document: newDoc('bar'),
        },
      ]);
      await v.stage([status.unstaged.foo]);
      await v.takeSnapshot('Add foo');
      const history = await v.getHistory();
      expect(history).toEqual([
        {
          id: 'a3f9bf26f8c1faac67f6b740f255f5c7f3bb8297',
          author: '',
          created: expect.any(Date),
          name: 'Add foo',
          description: '',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: 'f084c7823f01300890d0d6539cfaffa5e2398da1',
              key: 'foo',
              name: 'Foo',
            },
          ],
        },
      ]);
      const status2 = await v.status([]);
      await v.stage([status2.unstaged.foo]);
      await v.takeSnapshot('Delete foo');
      const history2 = await v.getHistory();
      expect(history2).toEqual([
        {
          id: 'a3f9bf26f8c1faac67f6b740f255f5c7f3bb8297',
          author: '',
          created: expect.any(Date),
          name: 'Add foo',
          description: '',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: 'f084c7823f01300890d0d6539cfaffa5e2398da1',
              key: 'foo',
              name: 'Foo',
            },
          ],
        },
        {
          id: '334636a325ea1a8f4578b8fc59653ec6a6421f20',
          author: '',
          created: expect.any(Date),
          name: 'Delete foo',
          description: '',
          parent: 'a3f9bf26f8c1faac67f6b740f255f5c7f3bb8297',
          state: [],
        },
      ]);
    });
  });

  describe('getBranchNames()', () => {
    it('lists branches', async () => {
      const v = await vcs('master');
      await v.checkout([], 'branch-1');
      await v.checkout([], 'branch-2');
      const branches = await v.getBranchNames();
      expect(branches).toEqual(['master', 'branch-1', 'branch-2']);
    });
  });

  describe('removeBranch()', () => {
    it('cannot remove empty branch', async () => {
      const v = await vcs('master');
      let didError = false;

      try {
        // @ts-expect-error intentionally invalid
        await v.removeBranch();
      } catch {
        didError = true;
      }

      expect(didError).toBe(true);
    });

    it('cannot remove current branch', async () => {
      const v = await vcs('master');
      let didError = false;

      try {
        await v.removeBranch('master');
      } catch {
        didError = true;
      }

      expect(didError).toBe(true);
    });

    it('remove branch', async () => {
      const v = await vcs('master');
      // Add something to master
      const status1 = await v.status([
        {
          key: 'foo',
          name: 'Foo',
          document: newDoc('bar'),
        },
      ]);
      await v.stage([status1.unstaged.foo]);
      await v.takeSnapshot('Add foo');
      // Checkout branch
      await v.checkout([], 'new-branch');
      expect(await v.getBranchNames()).toEqual(['master', 'new-branch']);
      // Back to master and delete other branch
      await v.checkout([], 'master');
      await v.removeBranch('new-branch');
      expect(await v.getBranchNames()).toEqual(['master']);
    });
  });

  describe('fork()', () => {
    it('forks to a new branch', async () => {
      const v = await vcs('master');
      // Add something to master
      const status1 = await v.status(
        [
          {
            key: 'foo',
            name: 'Foo',
            document: newDoc('bar'),
          },
        ],
        {},
      );
      await v.stage([status1.unstaged.foo]);
      await v.takeSnapshot('Add foo');
      // Checkout branch
      await v.fork('new-branch');
      await v.checkout([], 'new-branch');
      const history = await v.getHistory();
      expect(await v.getCurrentBranchName()).toBe('new-branch');
      expect(history).toEqual([
        {
          created: expect.any(Date),
          id: 'ef8dbe0689eaea5394e40687f25214a1db994156',
          author: '',
          parent: '0000000000000000000000000000000000000000',
          name: 'Add foo',
          description: '',
          state: [
            {
              blob: 'f084c7823f01300890d0d6539cfaffa5e2398da1',
              key: 'foo',
              name: 'Foo',
            },
          ],
        },
      ]);
    });
  });

  describe('merge()', () => {
    it('performs fast-forward merge', async () => {
      const v = await vcs('master');
      const status1 = await v.status(
        [
          {
            key: 'a',
            name: 'A',
            document: newDoc('aaa'),
          },
          {
            key: 'b',
            name: 'B',
            document: newDoc('bbb'),
          },
        ],
        {},
      );
      await v.stage([status1.unstaged.a, status1.unstaged.b]);
      await v.takeSnapshot('Add A and B');
      expect((await v.getHistory())[0].state).toEqual([
        expect.objectContaining({
          key: 'a',
        }),
        expect.objectContaining({
          key: 'b',
        }),
      ]);
      await v.fork('feature-a');
      await v.checkout([], 'feature-a');
      const status2 = await v.status([
        {
          key: 'a',
          name: 'A',
          document: newDoc('aaa'),
        },
        {
          key: 'b',
          name: 'B',
          document: newDoc('bbbbbbb'),
        },
        {
          key: 'c',
          name: 'C',
          document: newDoc('ccc'),
        },
      ]);
      await v.stage([status2.unstaged.b, status2.unstaged.c]);
      await v.takeSnapshot('Add C, modify B');
      expect((await v.getHistory())[1].state).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'a',
          }),
          expect.objectContaining({
            key: 'b',
          }),
          expect.objectContaining({
            key: 'c',
          }),
        ]),
      );
    });

    it('merges even if no common root', async () => {
      const v = await vcs('master');
      const status1 = await v.status(
        [
          {
            key: 'a',
            name: 'A',
            document: newDoc('aaa'),
          },
          {
            key: 'b',
            name: 'B',
            document: newDoc('bbb'),
          },
        ],
        {},
      );
      await v.stage([status1.unstaged.a, status1.unstaged.b]);
      await v.takeSnapshot('message');
    });

    it('does something', async () => {
      const v = await vcs('master');
      // Add a file to master
      expect(await v.getCurrentBranchName()).toBe('master');
      const status1 = await v.status(
        [
          {
            key: 'a',
            name: 'A',
            document: newDoc('aaa'),
          },
        ],
        {},
      );
      await v.stage([status1.unstaged.a]);
      await v.takeSnapshot('Add A');
      expect(await v.getHistory()).toEqual([
        {
          id: '03ac0d9058614e1cafc6c53553bd0924b03f0b53',
          author: '',
          created: expect.any(Date),
          parent: '0000000000000000000000000000000000000000',
          name: 'Add A',
          description: '',
          state: [
            {
              blob: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
              key: 'a',
              name: 'A',
            },
          ],
        },
      ]);
      // Checkout new branch and add file
      await v.fork('new-branch');
      await v.checkout([], 'new-branch');
      expect(await v.getCurrentBranchName()).toBe('new-branch');
      const status2 = await v.status(
        [
          {
            key: 'b',
            name: 'B',
            document: newDoc('bbb'),
          },
        ],
        {},
      );
      await v.stage([status2.unstaged.b]);
      await v.takeSnapshot('Add B');
      expect(await v.getHistory()).toEqual([
        {
          id: '03ac0d9058614e1cafc6c53553bd0924b03f0b53',
          author: '',
          created: expect.any(Date),
          parent: '0000000000000000000000000000000000000000',
          name: 'Add A',
          description: '',
          state: [
            {
              blob: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
              key: 'a',
              name: 'A',
            },
          ],
        },
        {
          id: '4a193e0464ce2846b011301febc65513f81ca43e',
          author: '',
          created: expect.any(Date),
          parent: '03ac0d9058614e1cafc6c53553bd0924b03f0b53',
          name: 'Add B',
          description: '',
          state: [
            {
              blob: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
              key: 'a',
              name: 'A',
            },
            {
              blob: 'd42a1e9b61f31d85f54981d976aea411864c13c0',
              key: 'b',
              name: 'B',
            },
          ],
        },
      ]);
      // Merge new branch back into master
      await v.checkout([], 'master');
      expect(await v.getCurrentBranchName()).toBe('master');
      await v.merge([], 'new-branch');
      expect(await v.getHistory()).toEqual([
        {
          id: '03ac0d9058614e1cafc6c53553bd0924b03f0b53',
          author: '',
          created: expect.any(Date),
          parent: '0000000000000000000000000000000000000000',
          name: 'Add A',
          description: '',
          state: [
            {
              blob: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
              key: 'a',
              name: 'A',
            },
          ],
        },
        {
          id: '4a193e0464ce2846b011301febc65513f81ca43e',
          author: '',
          created: expect.any(Date),
          parent: '03ac0d9058614e1cafc6c53553bd0924b03f0b53',
          name: 'Add B',
          description: '',
          state: [
            {
              blob: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
              key: 'a',
              name: 'A',
            },
            {
              blob: 'd42a1e9b61f31d85f54981d976aea411864c13c0',
              key: 'b',
              name: 'B',
            },
          ],
        },
      ]);
    });
  });

  describe('describeChanges()', () => {
    it('works with same object structure', async () => {
      const a = workspaceModelBuilder.reset().name('foo').certificates({ baz: 10 }).build();
      const b = workspaceModelBuilder.reset().name('baz').certificates({ baz: 11 }).build();
      expect(describeChanges(a, b)).toEqual(['name', 'certificates']);
    });

    it('ignores modified key', () => {
      const a = workspaceModelBuilder.reset().name('foo').certificates({ baz: 10 }).modified(10).build();
      const b = workspaceModelBuilder.reset().name('baz').certificates({ baz: 11 }).modified(12).build();
      expect(describeChanges(a, b)).toEqual(['name', 'certificates']);
    });

    it('skips invalid values', () => {
      const a = null;
      const b = workspaceModelBuilder.reset().name('baz').certificates({ baz: 11 }).modified(12).build();
      // @ts-expect-error intentionally invalid
      expect(describeChanges(a, b)).toEqual([]);
    });
  });

  describe('getHistory()', () => {
    let v;
    beforeEach(async () => {
      v = await vcs('master');
      const status1 = await v.status(
        [
          {
            key: 'foo',
            name: 'Foo',
            document: newDoc('foobar1'),
          },
        ],
        {},
      );
      await v.stage([status1.unstaged.foo]);
      await v.takeSnapshot('Add foo');
      const status2 = await v.status(
        [
          {
            key: 'bar',
            name: 'Bar',
            document: newDoc('foobar2'),
          },
        ],
        {},
      );
      await v.stage([status2.unstaged.bar]);
      await v.takeSnapshot('Add bar');
    });

    it('returns all history', async () => {
      // get all history
      expect(await v.getHistory()).toStrictEqual([
        {
          author: '',
          created: expect.any(Date),
          description: '',
          id: '226811e0115cfb3254b01b012de1ceeb6059e3c2',
          name: 'Add foo',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: '863157e3f6c69379105291f0af83a70992922d00',
              key: 'foo',
              name: 'Foo',
            },
          ],
        },
        {
          author: '',
          created: expect.any(Date),
          description: '',
          id: 'e0631e398809cbd4157f180a3e045e5f8fb9db4e',
          name: 'Add bar',
          parent: '226811e0115cfb3254b01b012de1ceeb6059e3c2',
          state: [
            {
              blob: '863157e3f6c69379105291f0af83a70992922d00',
              key: 'foo',
              name: 'Foo',
            },
            {
              blob: 'aa111c748fec72729b19f3c018d1d2c98af2c0a1',
              key: 'bar',
              name: 'Bar',
            },
          ],
        },
      ]);
    });

    it('returns recent history', async () => {
      const [s1, s2, ...others] = await v.getHistory();
      // There should only be two items
      expect(others).toHaveLength(0);
      // Get the latest item
      expect(await v.getHistory(1)).toStrictEqual([s2]);
      // Get the last 2 items
      expect(await v.getHistory(2)).toStrictEqual([s1, s2]);
      // Get the last 3 items (only 2 exist)
      expect(await v.getHistory(3)).toStrictEqual([s1, s2]);
    });
  });

  it('validate branch names', async () => {
    expect(VCS.validateBranchName('branchA')).toEqual('');
    expect(VCS.validateBranchName('feat/branch-A')).toEqual('');
    expect(VCS.validateBranchName('A')).toEqual(
      'Branch names must be at least 3 characters long and can only contain English letters, numbers, period (.), hyphen (-), underscore (_) and forward slash (/)',
    );
    expect(VCS.validateBranchName('U*&(')).toEqual(
      'Branch names must be at least 3 characters long and can only contain English letters, numbers, period (.), hyphen (-), underscore (_) and forward slash (/)',
    );
    expect(VCS.validateBranchName('/feature')).toEqual('Branch names must start with a letter or number');
    expect(VCS.validateBranchName('feature/')).toEqual('Branch names must not end with a forward slash (/)');
    expect(VCS.validateBranchName('feature//A')).toEqual(
      'Branch names must not contain consecutive forward slashes (//)',
    );
    expect(VCS.validateBranchName('feature.')).toEqual('Branch names must not end with a period (.)');
    expect(VCS.validateBranchName('feature/../A')).toEqual('Branch names must not contain consecutive periods (..)');
    expect(VCS.validateBranchName('feature/.A/B')).toEqual(
      'No slash-separated component in branch name can begin with a period (.)',
    );
    expect(VCS.validateBranchName('feature/A.lock/B')).toEqual(
      'No slash-separated component in branch name can end with the sequence .lock',
    );
  });

  // Placed last: every other test in this file pins snapshot ids drawn in order from a mocked
  // uuid pool (see the vi.mock('~/common/misc', ...) note at the top of the file), so inserting
  // a test earlier that calls generateId would shift every id literal below it.
  it('surfaces a stale staged entry as unstaged once the working tree reverts to HEAD (INS-3520)', async () => {
    const v = await vcs('master');

    // baseline commit: a = 'original'
    const s1 = await v.status([{ key: 'a', name: 'A', document: newDoc('original') }]);
    await v.stage([s1.unstaged.a]);
    await v.takeSnapshot('baseline');

    // modify and stage: a = 'modified'
    const s2 = await v.status([{ key: 'a', name: 'A', document: newDoc('modified') }]);
    await v.stage([s2.unstaged.a]);

    // revert the working tree back to the committed content
    const s3 = await v.status([{ key: 'a', name: 'A', document: newDoc('original') }]);

    // the stale 'modified' entry is still sitting in the stage...
    expect(s3.stage.a).toMatchObject({ blobId: hashDocument(newDoc('modified')).hash });
    // ...but it's no longer invisible: it now surfaces as an unstaged revert (index vs working
    // tree), instead of `unstaged` coming back empty while a phantom change waits to be committed.
    expect(s3.unstaged.a).toMatchObject({ modified: true, blobId: hashDocument(newDoc('original')).hash });

    // staging that revert clears the stale content instead of letting it get committed silently:
    // stage() drops any entry whose content round-trips back to what HEAD already has.
    await v.stage([s3.unstaged.a]);
    const s4 = await v.status([{ key: 'a', name: 'A', document: newDoc('original') }]);
    expect(s4.stage).toEqual({});
    expect(s4.unstaged).toEqual({});
    await expect(v.takeSnapshot('no-op revert')).rejects.toThrow(
      'No changes to commit. Please stage your changes first.',
    );
  });

  it('drops a staged addition once its deletion is staged, when it was never committed', async () => {
    const v = await vcs('master');
    const { hash: blobId, content: blobContent } = hashDocument(newDoc('new'));

    // stage a brand new (never committed) document
    const afterAdd = await v.stage([{ key: 'n', name: 'N', blobId, blobContent, added: true }]);
    expect(afterAdd.n).toBeDefined();

    // stage its deletion before it was ever committed: HEAD never had this key, so the net
    // effect relative to HEAD is nothing, not a "staged delete" of something that never existed.
    const afterDelete = await v.stage([{ key: 'n', name: 'N', blobId, deleted: true }]);
    expect(afterDelete.n).toBeUndefined();
  });

  it('surfaces a never-committed staged addition as unstaged once it is deleted from the working tree', async () => {
    const v = await vcs('master');
    const { hash: blobId, content: blobContent } = hashDocument(newDoc('new'));

    const s1 = await v.status([{ key: 'n', name: 'N', document: newDoc('new') }]);
    await v.stage([s1.unstaged.n]);

    // delete it from the working tree before it was ever committed
    const s2 = await v.status([]);

    expect(s2.stage.n).toMatchObject({ added: true, blobId });
    // stageEntry ('n' staged as added) still holds real content, so the diff base shown to the
    // user is that staged content, not `null` — only a stage entry that is itself a deletion
    // (see the sibling test below) has nothing left in the index to show as previous content.
    expect(s2.unstaged.n).toMatchObject({ deleted: true, blobId, previousBlobContent: blobContent });
  });

  it('surfaces a re-added document as unstaged once its prior deletion is staged', async () => {
    const v = await vcs('master');

    // baseline commit: r = 'original'
    const s1 = await v.status([{ key: 'r', name: 'R', document: newDoc('original') }]);
    await v.stage([s1.unstaged.r]);
    await v.takeSnapshot('baseline');

    // delete it and stage the deletion
    const s2 = await v.status([]);
    await v.stage([s2.unstaged.r]);

    // it comes back with new content before the deletion was ever committed
    const s3 = await v.status([{ key: 'r', name: 'R', document: newDoc('recreated') }]);

    expect(s3.stage.r).toMatchObject({ deleted: true });
    // the index has nothing for 'r' at this point (it was staged as deleted), so there is no
    // staged content to show as the diff base.
    expect(s3.unstaged.r).toMatchObject({
      added: true,
      blobId: hashDocument(newDoc('recreated')).hash,
      previousBlobContent: JSON.stringify(null),
    });
  });

  it('surfaces a committed document staged as modified as unstaged once it is deleted from the working tree', async () => {
    const v = await vcs('master');

    // baseline commit: f = 'original'
    const s1 = await v.status([{ key: 'f', name: 'F', document: newDoc('original') }]);
    await v.stage([s1.unstaged.f]);
    await v.takeSnapshot('baseline');

    // modify and stage: f = 'modified'
    const s2 = await v.status([{ key: 'f', name: 'F', document: newDoc('modified') }]);
    await v.stage([s2.unstaged.f]);

    // delete it from the working tree before committing the modification
    const s3 = await v.status([]);

    const modifiedBlob = hashDocument(newDoc('modified'));
    expect(s3.stage.f).toMatchObject({ modified: true, blobId: modifiedBlob.hash });
    expect(s3.unstaged.f).toMatchObject({
      deleted: true,
      blobId: modifiedBlob.hash,
      previousBlobContent: JSON.stringify(JSON.parse(modifiedBlob.content)),
    });
  });
});

describe('chunkArray()', () => {
  it('works with exact divisor', () => {
    const chunks = chunkArray([1, 2, 3, 4, 5, 6], 3);
    expect(chunks).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('works with weird divisor', () => {
    const chunks = chunkArray([1, 2, 3, 4, 5, 6], 4);
    expect(chunks).toEqual([
      [1, 2, 3, 4],
      [5, 6],
    ]);
  });

  it('works with empty', () => {
    const chunks = chunkArray([], 4);
    expect(chunks).toEqual([]);
  });

  it('works with less than one chunk', () => {
    const chunks = chunkArray([1, 2], 4);
    expect(chunks).toEqual([[1, 2]]);
  });
});
