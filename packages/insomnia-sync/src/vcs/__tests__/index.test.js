import VCS from '../';
import MemoryDriver from '../../store/drivers/memory-driver';

describe('VCS', () => {
  beforeEach(() => {
    let ts = 1000000000000;
    Date.now = jest.fn(() => ts++);
  });

  describe('status()', () => {
    it('returns status with no commits', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status = await v.status([
        { key: 'foo', name: 'Foo', content: 'bar' },
        {
          key: 'baz',
          name: 'Baz',
          content: 'qux',
        },
      ]);

      expect(status).toEqual({
        key: 'df38f4b880dda9d746d376437c37cb8279027699',
        stage: {},
        unstaged: {
          foo: {
            added: true,
            key: 'foo',
            content: 'bar',
            blob: 'bdb2d8e7caa188ed5cb1b0295f65ce5e242b4324',
            name: 'Foo',
          },
          baz: {
            added: true,
            key: 'baz',
            content: 'qux',
            blob: '297880f41344b3d6712a26c3af39874aee73e68a',
            name: 'Baz',
          },
        },
      });
    });

    it('returns add/modify/delete operations', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status1 = await v.status([
        { key: 'a', name: 'A', content: 'aaa' },
        { key: 'b', name: 'B', content: 'bbb' },
        { key: 'c', name: 'C', content: 'ccc' },
      ]);
      expect(Object.keys(status1.unstaged)).toEqual(['a', 'b', 'c']);

      await v.stage([status1.unstaged['a'], status1.unstaged['b'], status1.unstaged['c']]);

      await v.takeSnapshot('Add a/b/c');
      const history = await v.getHistory();
      expect(history.length).toBe(1);
      expect(history).toEqual([
        {
          created: expect.any(Date),
          description: '',
          id: 'de8e451b54dc0643f7407a01ca4f9aa3b316ceef',
          name: 'Add a/b/c',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: 'a25088df90102215f8c5d2316b88780eb8837719',
              key: 'a',
              name: 'A',
            },
            {
              blob: 'a1c5176848e4fcd97e93e66970820321261ff105',
              key: 'b',
              name: 'B',
            },
            {
              blob: '621e19938969bfbedb2b7d52d6e3becda92d4dd3',
              key: 'c',
              name: 'C',
            },
          ],
        },
      ]);

      // Should get every operation type
      const status = await v.status([
        { key: 'notA', name: 'Not A', content: 'aaa' },
        { key: 'b', name: 'B', content: 'bbb' },
        { key: 'c', name: 'C', content: 'modified' },
        { key: 'd', name: 'D', content: 'ddd' },
      ]);

      expect(status).toEqual({
        key: '07e0837f56f314519214438a428773055f1e89c2',
        stage: {},
        unstaged: {
          a: {
            deleted: true,
            key: 'a',
            name: 'A',
          },
          notA: {
            added: true,
            blob: 'a25088df90102215f8c5d2316b88780eb8837719',
            key: 'notA',
            name: 'Not A',
            content: 'aaa',
          },
          c: {
            modified: true,
            blob: '852c13f844dbde131c16e0075e73482d715c1db2',
            key: 'c',
            name: 'C',
            content: 'modified',
          },
          d: {
            added: true,
            blob: 'c277a65b373a73686743876215d52f72d0991a24',
            key: 'd',
            name: 'D',
            content: 'ddd',
          },
        },
      });

      await v.stage([
        status.unstaged['a'],
        status.unstaged['notA'],
        status.unstaged['c'],
        status.unstaged['d'],
      ]);

      const status2 = await v.status([
        { key: 'notA', name: 'Not A', content: 'aaa' },
        { key: 'b', name: 'B', content: 'bbb' },
        { key: 'c', name: 'C', content: 'modified' },
        { key: 'd', name: 'D', content: 'ddd' },
      ]);

      expect(status2).toEqual({
        key: 'effd8aee048be3de0d8706dcf7970162354ee017',
        stage: {
          a: {
            deleted: true,
            key: 'a',
            name: 'A',
          },
          notA: {
            added: true,
            blob: 'a25088df90102215f8c5d2316b88780eb8837719',
            key: 'notA',
            name: 'Not A',
            content: 'aaa',
          },
          c: {
            modified: true,
            blob: '852c13f844dbde131c16e0075e73482d715c1db2',
            key: 'c',
            name: 'C',
            content: 'modified',
          },
          d: {
            added: true,
            blob: 'c277a65b373a73686743876215d52f72d0991a24',
            key: 'd',
            name: 'D',
            content: 'ddd',
          },
        },
        unstaged: {},
      });
    });

    it('can appear both staged and unstaged', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status = await v.status([
        { key: 'a', name: 'A', content: 'aaa' },
        { key: 'b', name: 'B', content: 'bbb' },
      ]);
      await v.stage([status.unstaged['a']]);

      const status2 = await v.status([
        { key: 'a', name: 'A', content: 'modified' },
        { key: 'b', name: 'B', content: 'bbb' },
      ]);

      expect(status2).toEqual({
        key: '7325dc3d7fe8420e11d79abb74baafe5433579a1',
        stage: {
          a: {
            added: true,
            blob: 'a25088df90102215f8c5d2316b88780eb8837719',
            name: 'A',
            key: 'a',
            content: 'aaa',
          },
        },
        unstaged: {
          a: {
            added: true,
            blob: '852c13f844dbde131c16e0075e73482d715c1db2',
            key: 'a',
            name: 'A',
            content: 'modified',
          },
          b: {
            added: true,
            blob: 'a1c5176848e4fcd97e93e66970820321261ff105',
            name: 'B',
            key: 'b',
            content: 'bbb',
          },
        },
      });
    });

    it('should not show committed entities', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status = await v.status([{ key: 'foo', name: 'Foo', content: 'bar' }]);
      await v.stage([status.unstaged['foo']]);
      await v.takeSnapshot('Add foo');

      const status2 = await v.status([{ key: 'foo', name: 'Foo', content: 'bar' }]);
      expect(status2).toEqual({
        key: 'a879eff7f977bb847932749776643a491bec00c7',
        stage: {},
        unstaged: {},
      });
    });
  });

  describe('stage()', () => {
    it('stages entity', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status = await v.status([
        { key: 'foo', name: 'Foo', content: 'bar' },
        { key: 'baz', name: 'Baz', content: 'qux' },
      ]);

      const stage = await v.stage([status.unstaged['foo']]);
      expect(stage).toEqual({
        foo: {
          key: 'foo',
          name: 'Foo',
          content: 'bar',
          blob: 'bdb2d8e7caa188ed5cb1b0295f65ce5e242b4324',
          added: true,
        },
      });

      const status2 = await v.status([
        { key: 'foo', name: 'Foo', content: 'bar' },
        { key: 'baz', name: 'Baz', content: 'qux' },
      ]);
      expect(status2).toEqual({
        key: '65f99ae937aca2ed7947a13be349f390eb32fe41',
        stage: {
          foo: {
            name: 'Foo',
            key: 'foo',
            content: 'bar',
            blob: 'bdb2d8e7caa188ed5cb1b0295f65ce5e242b4324',
            added: true,
          },
        },
        unstaged: {
          baz: {
            key: 'baz',
            name: 'Baz',
            content: 'qux',
            blob: '297880f41344b3d6712a26c3af39874aee73e68a',
            added: true,
          },
        },
      });
    });
  });

  describe('takeSnapshot()', () => {
    it('commits basic entity', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status = await v.status([{ key: 'foo', name: 'Foo', content: 'bar' }]);
      await v.stage([status.unstaged['foo']]);
      await v.takeSnapshot('Add foo');

      const history = await v.getHistory();
      expect(history).toEqual([
        {
          id: '3cf40b61d7ed271819aa8defd6212bf63aee6eae',
          created: expect.any(Date),
          name: 'Add foo',
          description: '',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: 'bdb2d8e7caa188ed5cb1b0295f65ce5e242b4324',
              key: 'foo',
              name: 'Foo',
            },
          ],
        },
      ]);
    });

    it('commits deleted entity', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status = await v.status([{ key: 'foo', name: 'Foo', content: 'bar' }]);
      await v.stage([status.unstaged['foo']]);
      await v.takeSnapshot('Add foo');

      const history = await v.getHistory();
      expect(history).toEqual([
        {
          id: '3cf40b61d7ed271819aa8defd6212bf63aee6eae',
          created: expect.any(Date),
          name: 'Add foo',
          description: '',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: 'bdb2d8e7caa188ed5cb1b0295f65ce5e242b4324',
              key: 'foo',
              name: 'Foo',
            },
          ],
        },
      ]);

      const status2 = await v.status([]);
      await v.stage([status2.unstaged['foo']]);
      await v.takeSnapshot('Delete foo');
      const history2 = await v.getHistory();

      expect(history2).toEqual([
        {
          id: '3cf40b61d7ed271819aa8defd6212bf63aee6eae',
          created: expect.any(Date),
          name: 'Add foo',
          description: '',
          parent: '0000000000000000000000000000000000000000',
          state: [
            {
              blob: 'bdb2d8e7caa188ed5cb1b0295f65ce5e242b4324',
              key: 'foo',
              name: 'Foo',
            },
          ],
        },
        {
          id: 'ce9293f9915adb9763837e3fff7730d45b2e0660',
          created: expect.any(Date),
          name: 'Delete foo',
          description: '',
          parent: '3cf40b61d7ed271819aa8defd6212bf63aee6eae',
          state: [],
        },
      ]);
    });
  });

  describe('getBranches()', () => {
    it('lists branches', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      await v.checkout('branch-1');
      await v.checkout('branch-2');

      const branches = await v.getBranches();
      expect(branches).toEqual(['master', 'branch-1', 'branch-2']);
    });
  });

  describe('removeBranch()', () => {
    it('cannot remove empty branch', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      let didError = false;
      try {
        await v.removeBranch();
      } catch (err) {
        didError = true;
      }

      expect(didError).toBe(true);
    });

    it('cannot remove current branch', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      let didError = false;
      try {
        await v.removeBranch('master');
      } catch (err) {
        didError = true;
      }

      expect(didError).toBe(true);
    });

    it('remove branch', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      // Add something to master
      const status1 = await v.status([{ key: 'foo', name: 'Foo', content: 'bar' }]);
      await v.stage([status1.unstaged['foo']]);
      await v.takeSnapshot('Add foo');

      // Checkout branch
      await v.checkout('new-branch');
      expect(await v.getBranches()).toEqual(['master', 'new-branch']);

      // Back to master and delete other branch
      await v.checkout('master');
      await v.removeBranch('new-branch');
      expect(await v.getBranches()).toEqual(['master']);
    });
  });

  describe('fork()', () => {
    it('forks to a new branch', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      // Add something to master
      const status1 = await v.status([{ key: 'foo', name: 'Foo', content: 'bar' }]);
      await v.stage([status1.unstaged['foo']]);
      await v.takeSnapshot('Add foo');

      // Checkout branch
      await v.fork('new-branch');
      await v.checkout('new-branch');
      const history = await v.getHistory();
      expect(await v.getBranch()).toBe('new-branch');
      expect(history).toEqual([
        {
          created: expect.any(Date),
          id: '3cf40b61d7ed271819aa8defd6212bf63aee6eae',
          parent: '0000000000000000000000000000000000000000',
          name: 'Add foo',
          description: '',
          state: [
            {
              blob: 'bdb2d8e7caa188ed5cb1b0295f65ce5e242b4324',
              key: 'foo',
              name: 'Foo',
            },
          ],
        },
      ]);
    });
  });

  const name = 'merge()';
  describe(name, () => {
    // it('does not merge if trees are the same', async () => {
    //   throw new Error('Fix me');
    // });

    it('does something', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      // Add a file to master
      expect(await v.getBranch()).toBe('master');
      const status1 = await v.status([{ key: 'a', name: 'A', content: 'aaa' }]);
      await v.stage([status1.unstaged['a']]);
      await v.takeSnapshot('Add A');
      expect(await v.getHistory()).toEqual([
        {
          id: '108e6d689aac1553b096f0161567902125246ce1',
          created: expect.any(Date),
          parent: '0000000000000000000000000000000000000000',
          name: 'Add A',
          description: '',
          state: [
            {
              blob: 'a25088df90102215f8c5d2316b88780eb8837719',
              key: 'a',
              name: 'A',
            },
          ],
        },
      ]);

      // Checkout new branch and add file
      await v.fork('new-branch');
      await v.checkout('new-branch');
      expect(await v.getBranch()).toBe('new-branch');

      const status2 = await v.status([{ key: 'b', name: 'B', content: 'bbb' }]);
      await v.stage([status2.unstaged['b']]);
      await v.takeSnapshot('Add B');
      expect(await v.getHistory()).toEqual([
        {
          id: '108e6d689aac1553b096f0161567902125246ce1',
          created: expect.any(Date),
          parent: '0000000000000000000000000000000000000000',
          name: 'Add A',
          description: '',
          state: [
            {
              blob: 'a25088df90102215f8c5d2316b88780eb8837719',
              key: 'a',
              name: 'A',
            },
          ],
        },
        {
          id: 'cc7592fa3a19f2864d14b3b5dc2aae4616d038c7',
          created: expect.any(Date),
          parent: '108e6d689aac1553b096f0161567902125246ce1',
          name: 'Add B',
          description: '',
          state: [
            {
              blob: 'a25088df90102215f8c5d2316b88780eb8837719',
              key: 'a',
              name: 'A',
            },
            {
              blob: 'a1c5176848e4fcd97e93e66970820321261ff105',
              key: 'b',
              name: 'B',
            },
          ],
        },
      ]);

      // Merge new branch back into master
      await v.checkout('master');
      expect(await v.getBranch()).toBe('master');
      await v.merge('new-branch');
      expect(await v.getHistory()).toEqual([
        {
          id: '108e6d689aac1553b096f0161567902125246ce1',
          created: expect.any(Date),
          parent: '0000000000000000000000000000000000000000',
          name: 'Add A',
          description: '',
          state: [
            {
              blob: 'a25088df90102215f8c5d2316b88780eb8837719',
              key: 'a',
              name: 'A',
            },
          ],
        },
        {
          id: 'cc7592fa3a19f2864d14b3b5dc2aae4616d038c7',
          created: expect.any(Date),
          parent: '108e6d689aac1553b096f0161567902125246ce1',
          name: 'Add B',
          description: '',
          state: [
            {
              blob: 'a25088df90102215f8c5d2316b88780eb8837719',
              key: 'a',
              name: 'A',
            },
            {
              blob: 'a1c5176848e4fcd97e93e66970820321261ff105',
              key: 'b',
              name: 'B',
            },
          ],
        },
      ]);
    });
  });
});
