import { createBuilder } from '@develohpanda/fluent-builder';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { baseModelSchema, workspaceModelSchema } from '../../../models/__schemas__/model-schemas';
import { projectSchema } from '../../__schemas__/type-schemas';
import MemoryDriver from '../../store/drivers/memory-driver';
import { BackendProject } from '../../types';
import * as paths from '../paths';
import { describeChanges } from '../util';
import { VCS } from '../vcs';

const baseModelBuilder = createBuilder(baseModelSchema);
const workspaceModelBuilder = createBuilder(workspaceModelSchema);
const projectBuilder = createBuilder(projectSchema);

function newDoc(id) {
  return baseModelBuilder.reset()._id(id).build();
}

async function vcs(branch) {
  const v = new VCS(new MemoryDriver());
  await v.switchAndCreateBackendProjectIfNotExist('workspace_1', 'Test Workspace');
  await v.checkout([], branch);
  return v;
}

describe('VCS', () => {
  beforeEach(async () => {
    let ts = 1000000000000;
    Date.now = jest.fn(() => ts++);
    await globalBeforeEach();
  });

  describe('status()', () => {
    it('returns status with no commits', async () => {
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
      expect(status).toEqual({
        key: 'a156b75bc8fd5ad4e0e3da036c30667af631cf2b',
        stage: {},
        unstaged: {
          foo: {
            added: true,
            key: 'foo',
            blobContent: '{"_id":"bar","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            blobId: 'f084c7823f01300890d0d6539cfaffa5e2398da1',
            name: 'Foo',
          },
          baz: {
            added: true,
            key: 'baz',
            blobContent: '{"_id":"qux","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            blobId: 'aee296597cedfbfe6c961b0c48a5e05c6acb1da3',
            name: 'Baz',
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
      const stageResult = await v.stage(status1.stage, [status1.unstaged.a, status1.unstaged.b, status1.unstaged.c]);
      await v.takeSnapshot(stageResult, 'Add a/b/c');
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
        key: 'dc9ac9680eabf62d94d63c862d5b863453c4fc72',
        stage: {},
        unstaged: {
          a: {
            deleted: true,
            blobId: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
            key: 'a',
            name: 'A',
          },
          notA: {
            added: true,
            key: 'notA',
            name: 'Not A',
            blobId: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
            blobContent: '{"_id":"aaa","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
          },
          c: {
            modified: true,
            key: 'c',
            name: 'C',
            blobId: '87a13a793c6bc2137732ba4f8dc8d877fc143bad',
            blobContent: '{"_id":"modified","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
          },
          d: {
            added: true,
            key: 'd',
            name: 'D',
            blobId: 'cb6c7a2814104ff614133076245ae32fe9a62c8f',
            blobContent: '{"_id":"ddd","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
          },
        },
      });
      const newStage = await v.stage(status.stage, [
        status.unstaged.a,
        status.unstaged.notA,
        status.unstaged.c,
        status.unstaged.d,
      ]);
      const status2 = await v.status(
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
        newStage,
      );
      expect(status2).toEqual({
        key: 'fa7e77538196bd6c337d9271b2a3af87abde3e15',
        stage: {
          a: {
            deleted: true,
            blobId: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
            key: 'a',
            name: 'A',
          },
          notA: {
            added: true,
            blobId: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
            key: 'notA',
            name: 'Not A',
            blobContent: '{"_id":"aaa","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
          },
          c: {
            modified: true,
            blobId: '87a13a793c6bc2137732ba4f8dc8d877fc143bad',
            key: 'c',
            name: 'C',
            blobContent: '{"_id":"modified","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
          },
          d: {
            added: true,
            blobId: 'cb6c7a2814104ff614133076245ae32fe9a62c8f',
            key: 'd',
            name: 'D',
            blobContent: '{"_id":"ddd","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
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
      const stage = await v.stage(status.stage, [status.unstaged.a]);
      const status2 = await v.status(
        [
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
        ],
        stage,
      );
      expect(status2).toEqual({
        key: 'f92908bb0e471e61e0903b8c669f9d20e8d7c8f0',
        stage: {
          a: {
            added: true,
            blobId: '4a1582f059cf4cc4c4dcd56e893b9ae88f32125d',
            name: 'A',
            key: 'a',
            blobContent: '{"_id":"aaa","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
          },
        },
        unstaged: {
          a: {
            added: true,
            blobId: '87a13a793c6bc2137732ba4f8dc8d877fc143bad',
            key: 'a',
            name: 'A',
            blobContent: '{"_id":"modified","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
          },
          b: {
            added: true,
            blobId: 'd42a1e9b61f31d85f54981d976aea411864c13c0',
            name: 'B',
            key: 'b',
            blobContent: '{"_id":"bbb","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
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
      const stage2 = await v.stage(status.stage, [status.unstaged.foo]);
      await v.takeSnapshot(stage2, 'Add foo');
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
        key: 'ca455b43c1e992812d81032e79e037a8db85fa8b',
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
      const stage = await v.stage(status.stage, [status.unstaged.foo]);
      expect(stage).toEqual({
        foo: {
          key: 'foo',
          name: 'Foo',
          blobContent: '{"_id":"bar","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
          blobId: 'f084c7823f01300890d0d6539cfaffa5e2398da1',
          added: true,
        },
      });
      const status2 = await v.status(
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
        stage,
      );
      expect(status2).toEqual({
        key: '83dfd47a77c5015169d611f6559b18ea588ad89a',
        stage: {
          foo: {
            name: 'Foo',
            key: 'foo',
            blobContent: '{"_id":"bar","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            blobId: 'f084c7823f01300890d0d6539cfaffa5e2398da1',
            added: true,
          },
        },
        unstaged: {
          baz: {
            key: 'baz',
            name: 'Baz',
            blobContent: '{"_id":"qux","created":1234,"isPrivate":false,"name":"name","parentId":"","type":"base"}',
            blobId: 'aee296597cedfbfe6c961b0c48a5e05c6acb1da3',
            added: true,
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
      const stage = await v.stage(status.stage, [status.unstaged.foo]);
      await v.takeSnapshot(stage, 'Add foo');
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
      const stage = await v.stage(status.stage, [status.unstaged.foo]);
      await v.takeSnapshot(stage, 'Add foo');
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
      const status2 = await v.status([], {});
      const stage2 = await v.stage(status2.stage, [status2.unstaged.foo]);
      await v.takeSnapshot(stage2, 'Delete foo');
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

  describe('getBranches()', () => {
    it('lists branches', async () => {
      const v = await vcs('master');
      await v.checkout([], 'branch-1');
      await v.checkout([], 'branch-2');
      const branches = await v.getBranches();
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
      } catch (err) {
        didError = true;
      }

      expect(didError).toBe(true);
    });

    it('cannot remove current branch', async () => {
      const v = await vcs('master');
      let didError = false;

      try {
        await v.removeBranch('master');
      } catch (err) {
        didError = true;
      }

      expect(didError).toBe(true);
    });

    it('remove branch', async () => {
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
      const stage1 = await v.stage(status1.stage, [status1.unstaged.foo]);
      await v.takeSnapshot(stage1, 'Add foo');
      // Checkout branch
      await v.checkout([], 'new-branch');
      expect(await v.getBranches()).toEqual(['master', 'new-branch']);
      // Back to master and delete other branch
      await v.checkout([], 'master');
      await v.removeBranch('new-branch');
      expect(await v.getBranches()).toEqual(['master']);
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
      const stage1 = await v.stage(status1.stage, [status1.unstaged.foo]);
      await v.takeSnapshot(stage1, 'Add foo');
      // Checkout branch
      await v.fork('new-branch');
      await v.checkout([], 'new-branch');
      const history = await v.getHistory();
      expect(await v.getBranch()).toBe('new-branch');
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
      const stage1 = await v.stage(status1.stage, [status1.unstaged.a, status1.unstaged.b]);
      await v.takeSnapshot(stage1, 'Add A and B');
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
      const status2 = await v.status(
        [
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
        ],
        status1.stage,
      );
      const stage2 = await v.stage(status2.stage, [status2.unstaged.b, status2.unstaged.c]);
      await v.takeSnapshot(stage2, 'Add C, modify B');
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
      const stage1 = await v.stage(status1.stage, [status1.unstaged.a, status1.unstaged.b]);
      await v.takeSnapshot(stage1, 'message');
    });

    it('does something', async () => {
      const v = await vcs('master');
      // Add a file to master
      expect(await v.getBranch()).toBe('master');
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
      const stage = await v.stage(status1.stage, [status1.unstaged.a]);
      await v.takeSnapshot(stage, 'Add A');
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
      expect(await v.getBranch()).toBe('new-branch');
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
      const stage2 = await v.stage(status2.stage, [status2.unstaged.b]);
      await v.takeSnapshot(stage2, 'Add B');
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
      expect(await v.getBranch()).toBe('master');
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
      const stage1 = await v.stage(status1.stage, [status1.unstaged.foo]);
      await v.takeSnapshot(stage1, 'Add foo');
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
      const stage2 = await v.stage(status2.stage, [status2.unstaged.bar]);
      await v.takeSnapshot(stage2, 'Add bar');
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

  describe('hasBackendProjectForRootDocument', () => {
    let vcs: VCS;
    let backendProject: BackendProject;

    beforeEach(async () => {
      backendProject = projectBuilder.reset().build();

      const driver = new MemoryDriver();
      vcs = new VCS(driver);

      driver.setItem(paths.projects(), Buffer.from(JSON.stringify([backendProject])));
      driver.setItem(paths.projectBase(backendProject.id), Buffer.from(''));
      driver.setItem(paths.project(backendProject.id), Buffer.from(JSON.stringify(backendProject)));
    });

    it('should return true if has project', async () => {
      const hasProject = await vcs.hasBackendProjectForRootDocument(backendProject.rootDocumentId);

      expect(hasProject).toBe(true);
    });

    it('should return false if has no project', async () => {
      const hasProject = await vcs.hasBackendProjectForRootDocument('some other id');

      expect(hasProject).toBe(false);
    });
  });
});
