import VCS from '../index';
import MemoryDriver from '../../store/drivers/memory-driver';
import { describeChanges } from '../util';
import { globalBeforeEach } from '../../../__jest__/before-each';

function newDoc(id) {
  return { id };
}

async function vcs(branch) {
  const v = new VCS(new MemoryDriver());
  await v.switchAndCreateProjectIfNotExist('workspace_1', 'Test Workspace');
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
        key: '0cffac636df909fb4f8e9a25570e5012846b46fd',
        stage: {},
        unstaged: {
          foo: {
            added: true,
            key: 'foo',
            blobContent: '{"id":"bar"}',
            blobId: 'b933e3dbd1d218e2763de8e3ece6147527d046af',
            name: 'Foo',
          },
          baz: {
            added: true,
            key: 'baz',
            blobContent: '{"id":"qux"}',
            blobId: 'dc61fb5cb183286293dc7f0e8499b4e1e09eef05',
            name: 'Baz',
          },
        },
      });
    });

    it('returns add/modify/delete operations', async () => {
      const v = await vcs('master');

      const status1 = await v.status(
        [
          { key: 'a', name: 'A', document: newDoc('aaa') },
          { key: 'b', name: 'B', document: newDoc('bbb') },
          { key: 'c', name: 'C', document: newDoc('ccc') },
        ],
        {},
      );
      expect(Object.keys(status1.unstaged)).toEqual(['a', 'b', 'c']);

      await v.stage(status1.stage, [status1.unstaged.a, status1.unstaged.b, status1.unstaged.c]);

      await v.takeSnapshot(status1.stage, 'Add a/b/c');
      const history = await v.getHistory();
      expect(history.length).toBe(1);
      expect(history).toEqual([
        {
          created: expect.any(Date),
          description: '',
          author: '',
          id: 'a5fb7270c060c0387967c6db725fdf07e9594911',
          name: 'Add a/b/c',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: '210be55f7998bb55805f9d65c5345103e7957929',
              key: 'a',
              name: 'A',
            },
            {
              blob: '8ce1aded8fa999d1c5632ff993b56dd9aa1f4880',
              key: 'b',
              name: 'B',
            },
            {
              blob: 'ce29c03e80866a215004d55f160a9a7b510ceacb',
              key: 'c',
              name: 'C',
            },
          ],
        },
      ]);

      // Should get every operation type
      const status = await v.status(
        [
          { key: 'notA', name: 'Not A', document: newDoc('aaa') },
          { key: 'b', name: 'B', document: newDoc('bbb') },
          { key: 'c', name: 'C', document: newDoc('modified') },
          { key: 'd', name: 'D', document: newDoc('ddd') },
        ],
        {},
      );

      expect(status).toEqual({
        key: '80834d815272c73192291477f70dce8a7c8bc424',
        stage: {},
        unstaged: {
          a: {
            deleted: true,
            blobId: '210be55f7998bb55805f9d65c5345103e7957929',
            key: 'a',
            name: 'A',
          },
          notA: {
            added: true,
            key: 'notA',
            name: 'Not A',
            blobId: '210be55f7998bb55805f9d65c5345103e7957929',
            blobContent: '{"id":"aaa"}',
          },
          c: {
            modified: true,
            key: 'c',
            name: 'C',
            blobId: 'c32090250612936632fa4a3127507aa0694ba375',
            blobContent: '{"id":"modified"}',
          },
          d: {
            added: true,
            key: 'd',
            name: 'D',
            blobId: 'd4d10ce251d7184fa14587796aed6e06c549f7a4',
            blobContent: '{"id":"ddd"}',
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
          { key: 'notA', name: 'Not A', document: newDoc('aaa') },
          { key: 'b', name: 'B', document: newDoc('bbb') },
          { key: 'c', name: 'C', document: newDoc('modified') },
          { key: 'd', name: 'D', document: newDoc('ddd') },
        ],
        newStage,
      );

      expect(status2).toEqual({
        key: '4a0e8fd9ee30acb9c8ff4eb2f73e413ff7175a8c',
        stage: {
          a: {
            deleted: true,
            blobId: '210be55f7998bb55805f9d65c5345103e7957929',
            key: 'a',
            name: 'A',
          },
          notA: {
            added: true,
            blobId: '210be55f7998bb55805f9d65c5345103e7957929',
            key: 'notA',
            name: 'Not A',
            blobContent: '{"id":"aaa"}',
          },
          c: {
            modified: true,
            blobId: 'c32090250612936632fa4a3127507aa0694ba375',
            key: 'c',
            name: 'C',
            blobContent: '{"id":"modified"}',
          },
          d: {
            added: true,
            blobId: 'd4d10ce251d7184fa14587796aed6e06c549f7a4',
            key: 'd',
            name: 'D',
            blobContent: '{"id":"ddd"}',
          },
        },
        unstaged: {},
      });
    });

    it('can appear both staged and unstaged', async () => {
      const v = await vcs('master');

      const status = await v.status(
        [
          { key: 'a', name: 'A', document: newDoc('aaa') },
          { key: 'b', name: 'B', document: newDoc('bbb') },
        ],
        {},
      );
      const stage = await v.stage(status.stage, [status.unstaged.a]);

      const status2 = await v.status(
        [
          { key: 'a', name: 'A', document: newDoc('modified') },
          { key: 'b', name: 'B', document: newDoc('bbb') },
        ],
        stage,
      );

      expect(status2).toEqual({
        key: '886337817e3c1ff7df3fcfa7c30192eb854b45cf',
        stage: {
          a: {
            added: true,
            blobId: '210be55f7998bb55805f9d65c5345103e7957929',
            name: 'A',
            key: 'a',
            blobContent: '{"id":"aaa"}',
          },
        },
        unstaged: {
          a: {
            added: true,
            blobId: 'c32090250612936632fa4a3127507aa0694ba375',
            key: 'a',
            name: 'A',
            blobContent: '{"id":"modified"}',
          },
          b: {
            added: true,
            blobId: '8ce1aded8fa999d1c5632ff993b56dd9aa1f4880',
            name: 'B',
            key: 'b',
            blobContent: '{"id":"bbb"}',
          },
        },
      });
    });

    it('should not show committed entities', async () => {
      const v = await vcs('master');

      const status = await v.status([{ key: 'foo', name: 'Foo', document: newDoc('bar') }], {});
      const stage2 = await v.stage(status.stage, [status.unstaged.foo]);
      await v.takeSnapshot(stage2, 'Add foo');

      const status2 = await v.status([{ key: 'foo', name: 'Foo', document: newDoc('bar') }], {});
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
          { key: 'foo', name: 'Foo', document: newDoc('bar') },
          { key: 'baz', name: 'Baz', document: newDoc('qux') },
        ],
        {},
      );

      const stage = await v.stage(status.stage, [status.unstaged.foo]);
      expect(stage).toEqual({
        foo: {
          key: 'foo',
          name: 'Foo',
          blobContent: '{"id":"bar"}',
          blobId: 'b933e3dbd1d218e2763de8e3ece6147527d046af',
          added: true,
        },
      });

      const status2 = await v.status(
        [
          { key: 'foo', name: 'Foo', document: newDoc('bar') },
          { key: 'baz', name: 'Baz', document: newDoc('qux') },
        ],
        stage,
      );
      expect(status2).toEqual({
        key: '19c281e6bbbebec0143491bf14f9a013a4114125',
        stage: {
          foo: {
            name: 'Foo',
            key: 'foo',
            blobContent: '{"id":"bar"}',
            blobId: 'b933e3dbd1d218e2763de8e3ece6147527d046af',
            added: true,
          },
        },
        unstaged: {
          baz: {
            key: 'baz',
            name: 'Baz',
            blobContent: '{"id":"qux"}',
            blobId: 'dc61fb5cb183286293dc7f0e8499b4e1e09eef05',
            added: true,
          },
        },
      });
    });
  });

  describe('takeSnapshot()', () => {
    it('commits basic entity', async () => {
      const v = await vcs('master');

      const status = await v.status([{ key: 'foo', name: 'Foo', document: newDoc('bar') }], {});
      const stage = await v.stage(status.stage, [status.unstaged.foo]);
      await v.takeSnapshot(stage, 'Add foo');

      const history = await v.getHistory();
      expect(history).toEqual([
        {
          id: '24b4888f4cecc5a1ac272eb1641cb5aa102c1675',
          author: '',
          created: expect.any(Date),
          name: 'Add foo',
          description: '',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: 'b933e3dbd1d218e2763de8e3ece6147527d046af',
              key: 'foo',
              name: 'Foo',
            },
          ],
        },
      ]);
    });

    it('commits deleted entity', async () => {
      const v = await vcs('master');

      const status = await v.status([{ key: 'foo', name: 'Foo', document: newDoc('bar') }], {});
      const stage = await v.stage(status.stage, [status.unstaged.foo]);
      await v.takeSnapshot(stage, 'Add foo');

      const history = await v.getHistory();
      expect(history).toEqual([
        {
          id: '365c4341f6d57e18994df2429387b78f2c9a31cb',
          author: '',
          created: expect.any(Date),
          name: 'Add foo',
          description: '',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: 'b933e3dbd1d218e2763de8e3ece6147527d046af',
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
          id: '365c4341f6d57e18994df2429387b78f2c9a31cb',
          author: '',
          created: expect.any(Date),
          name: 'Add foo',
          description: '',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: 'b933e3dbd1d218e2763de8e3ece6147527d046af',
              key: 'foo',
              name: 'Foo',
            },
          ],
        },
        {
          id: '42f5b05d004f99e875a7eb3fe24ad7f94ad3e0c5',
          author: '',
          created: expect.any(Date),
          name: 'Delete foo',
          description: '',
          parent: '365c4341f6d57e18994df2429387b78f2c9a31cb',
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
      const status1 = await v.status([{ key: 'foo', name: 'Foo', document: newDoc('bar') }], {});
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
      const status1 = await v.status([{ key: 'foo', name: 'Foo', document: newDoc('bar') }], {});
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
          id: 'e1afd0f5607d8da06b4360eb22d41650262f6dc5',
          author: '',
          parent: '0000000000000000000000000000000000000000',
          name: 'Add foo',
          description: '',
          state: [
            {
              blob: 'b933e3dbd1d218e2763de8e3ece6147527d046af',
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
          { key: 'a', name: 'A', document: newDoc('aaa') },
          { key: 'b', name: 'B', document: newDoc('bbb') },
        ],
        {},
      );
      const stage1 = await v.stage(status1.stage, [status1.unstaged.a, status1.unstaged.b]);
      await v.takeSnapshot(stage1, 'Add A and B');
      expect((await v.getHistory())[0].state).toEqual([
        expect.objectContaining({ key: 'a' }),
        expect.objectContaining({ key: 'b' }),
      ]);

      await v.fork('feature-a');
      await v.checkout([], 'feature-a');
      const status2 = await v.status(
        [
          { key: 'a', name: 'A', document: newDoc('aaa') },
          { key: 'b', name: 'B', document: newDoc('bbbbbbb') },
          { key: 'c', name: 'C', document: newDoc('ccc') },
        ],
        status1.stage,
      );
      const stage2 = await v.stage(status2.stage, [status2.unstaged.b, status2.unstaged.c]);
      await v.takeSnapshot(stage2, 'Add C, modify B');
      expect((await v.getHistory())[1].state).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'a' }),
          expect.objectContaining({ key: 'b' }),
          expect.objectContaining({ key: 'c' }),
        ]),
      );
    });

    it('merges even if no common root', async () => {
      const v = await vcs('master');

      const status1 = await v.status(
        [
          { key: 'a', name: 'A', document: newDoc('aaa') },
          { key: 'b', name: 'B', document: newDoc('bbb') },
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
      const status1 = await v.status([{ key: 'a', name: 'A', document: newDoc('aaa') }], {});
      const stage = await v.stage(status1.stage, [status1.unstaged.a]);
      await v.takeSnapshot(stage, 'Add A');
      expect(await v.getHistory()).toEqual([
        {
          id: 'c0b75a0cb27c946e376326b963ce544af08b680a',
          author: '',
          created: expect.any(Date),
          parent: '0000000000000000000000000000000000000000',
          name: 'Add A',
          description: '',
          state: [
            {
              blob: '210be55f7998bb55805f9d65c5345103e7957929',
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

      const status2 = await v.status([{ key: 'b', name: 'B', document: newDoc('bbb') }], {});
      const stage2 = await v.stage(status2.stage, [status2.unstaged.b]);
      await v.takeSnapshot(stage2, 'Add B');
      expect(await v.getHistory()).toEqual([
        {
          id: 'c0b75a0cb27c946e376326b963ce544af08b680a',
          author: '',
          created: expect.any(Date),
          parent: '0000000000000000000000000000000000000000',
          name: 'Add A',
          description: '',
          state: [
            {
              blob: '210be55f7998bb55805f9d65c5345103e7957929',
              key: 'a',
              name: 'A',
            },
          ],
        },
        {
          id: 'b0fb09c8ac80b34f94dc6751da6b5aa634682f45',
          author: '',
          created: expect.any(Date),
          parent: 'c0b75a0cb27c946e376326b963ce544af08b680a',
          name: 'Add B',
          description: '',
          state: [
            {
              blob: '210be55f7998bb55805f9d65c5345103e7957929',
              key: 'a',
              name: 'A',
            },
            {
              blob: '8ce1aded8fa999d1c5632ff993b56dd9aa1f4880',
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
          id: 'c0b75a0cb27c946e376326b963ce544af08b680a',
          author: '',
          created: expect.any(Date),
          parent: '0000000000000000000000000000000000000000',
          name: 'Add A',
          description: '',
          state: [
            {
              blob: '210be55f7998bb55805f9d65c5345103e7957929',
              key: 'a',
              name: 'A',
            },
          ],
        },
        {
          id: 'b0fb09c8ac80b34f94dc6751da6b5aa634682f45',
          author: '',
          created: expect.any(Date),
          parent: 'c0b75a0cb27c946e376326b963ce544af08b680a',
          name: 'Add B',
          description: '',
          state: [
            {
              blob: '210be55f7998bb55805f9d65c5345103e7957929',
              key: 'a',
              name: 'A',
            },
            {
              blob: '8ce1aded8fa999d1c5632ff993b56dd9aa1f4880',
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
      const a = { foo: 'bar', nested: { baz: 10 } };
      const b = { foo: 'baz', nested: { baz: 11 } };
      expect(describeChanges(a, b)).toEqual(['foo', 'nested']);
    });

    it('ignores modified key', () => {
      const a = { foo: 'bar', nested: { baz: 10 }, modified: 10 };
      const b = { foo: 'baz', nested: { baz: 11 }, modified: 12 };
      expect(describeChanges(a, b)).toEqual(['foo', 'nested']);
    });

    it('skips invalid values', () => {
      const a = null;
      const b = { foo: 'baz', nested: { baz: 11 }, modified: 12 };
      expect(describeChanges(a, b)).toEqual([]);
    });
  });

  describe('getHistory()', () => {
    let v;
    beforeEach(async () => {
      v = await vcs('master');

      const status1 = await v.status(
        [{ key: 'foo', name: 'Foo', document: newDoc('foobar1') }],
        {},
      );
      const stage1 = await v.stage(status1.stage, [status1.unstaged.foo]);
      await v.takeSnapshot(stage1, 'Add foo');

      const status2 = await v.status(
        [{ key: 'bar', name: 'Bar', document: newDoc('foobar2') }],
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
          id: 'f271aed3e12317215491ca1545770bd8289948e1',
          name: 'Add foo',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: 'f3827e9fdf461634c4ce528b88ced46fecf6509c',
              key: 'foo',
              name: 'Foo',
            },
          ],
        },
        {
          author: '',
          created: expect.any(Date),
          description: '',
          id: '3acf54915cd8d34a9cd9ea4ac3a988105b483869',
          name: 'Add bar',
          parent: 'f271aed3e12317215491ca1545770bd8289948e1',
          state: [
            {
              blob: 'f3827e9fdf461634c4ce528b88ced46fecf6509c',
              key: 'foo',
              name: 'Foo',
            },
            {
              blob: '2d1f409ab33b0b997d6c239a7754d24875570c2d',
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
});
