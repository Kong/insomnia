import VCS from '../';
import MemoryDriver from '../../store/drivers/memory-driver';

describe('VCS', () => {
  beforeEach(() => {
    let ts = 1000000000000;
    Date.now = jest.fn(() => ts++);
  });

  describe('status()', () => {
    it('returns status with not commits', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status = await v.status([{ id: 'foo', content: 'bar' }, { id: 'baz', content: 'qux' }]);

      expect(status).toEqual({
        stage: {},
        unstaged: {
          foo: {
            operation: 'add',
            id: 'foo',
            content: 'bar',
            hash: 'bdb2d8e7caa188ed5cb1b0295f65ce5e242b4324',
          },
          baz: {
            operation: 'add',
            id: 'baz',
            content: 'qux',
            hash: '297880f41344b3d6712a26c3af39874aee73e68a',
          },
        },
      });
    });

    it('returns add/modify/delete operations', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status1 = await v.status([
        { id: 'a', name: 'A', content: 'aaa' },
        { id: 'b', name: 'B', content: 'bbb' },
        { id: 'c', name: 'C', content: 'ccc' },
      ]);
      expect(Object.keys(status1.unstaged)).toEqual(['a', 'b', 'c']);

      await v.stage(status1.unstaged['a']);
      await v.stage(status1.unstaged['b']);
      await v.stage(status1.unstaged['c']);
      const { tree } = await v.commit('Add a/b/c');
      expect(Object.keys(tree).sort()).toEqual(['a', 'b', 'c']);

      // Should get every operation type
      const status = await v.status([
        { id: 'notA', name: 'Not A', content: 'aaa' },
        { id: 'b', name: 'B', content: 'bbb' },
        { id: 'c', name: 'C', content: 'modified' },
        { id: 'd', name: 'D', content: 'ddd' },
      ]);
      expect(status).toEqual({
        stage: {},
        unstaged: {
          a: {
            operation: 'delete',
            hash: 'a25088df90102215f8c5d2316b88780eb8837719',
            id: 'a',
            name: 'A',
            content: '',
          },
          notA: {
            operation: 'add',
            hash: 'a25088df90102215f8c5d2316b88780eb8837719',
            id: 'notA',
            name: 'Not A',
            content: 'aaa',
          },
          c: {
            operation: 'modify',
            hash: '852c13f844dbde131c16e0075e73482d715c1db2',
            id: 'c',
            name: 'C',
            content: 'modified',
          },
          d: {
            operation: 'add',
            hash: 'c277a65b373a73686743876215d52f72d0991a24',
            id: 'd',
            name: 'D',
            content: 'ddd',
          },
        },
      });

      await v.stage(status.unstaged['a']);
      await v.stage(status.unstaged['notA']);
      await v.stage(status.unstaged['c']);
      await v.stage(status.unstaged['d']);
      const status2 = await v.status([
        { id: 'notA', name: 'Not A', content: 'aaa' },
        { id: 'b', name: 'B', content: 'bbb' },
        { id: 'c', name: 'C', content: 'modified' },
        { id: 'd', name: 'D', content: 'ddd' },
      ]);
      expect(status2).toEqual({
        stage: {
          a: {
            operation: 'delete',
            hash: 'a25088df90102215f8c5d2316b88780eb8837719',
            id: 'a',
            name: 'A',
            content: '',
          },
          notA: {
            operation: 'add',
            hash: 'a25088df90102215f8c5d2316b88780eb8837719',
            id: 'notA',
            name: 'Not A',
            content: 'aaa',
          },
          c: {
            operation: 'modify',
            hash: '852c13f844dbde131c16e0075e73482d715c1db2',
            id: 'c',
            name: 'C',
            content: 'modified',
          },
          d: {
            operation: 'add',
            hash: 'c277a65b373a73686743876215d52f72d0991a24',
            id: 'd',
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
        { id: 'a', name: 'A', content: 'aaa' },
        { id: 'b', name: 'B', content: 'bbb' },
      ]);
      await v.stage(status.unstaged['a']);

      const status2 = await v.status([
        { id: 'a', name: 'A', content: 'modified' },
        { id: 'b', name: 'B', content: 'bbb' },
      ]);
      expect(status2).toEqual({
        stage: {
          a: {
            operation: 'add',
            hash: 'a25088df90102215f8c5d2316b88780eb8837719',
            name: 'A',
            id: 'a',
            content: 'aaa',
          },
        },
        unstaged: {
          a: {
            operation: 'add',
            hash: '852c13f844dbde131c16e0075e73482d715c1db2',
            id: 'a',
            name: 'A',
            content: 'modified',
          },
          b: {
            operation: 'add',
            hash: 'a1c5176848e4fcd97e93e66970820321261ff105',
            name: 'B',
            id: 'b',
            content: 'bbb',
          },
        },
      });
    });

    it('should not show committed entities', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status = await v.status([{ id: 'foo', name: 'Foo', content: 'bar' }]);
      await v.stage(status.unstaged['foo']);
      await v.commit('Add foo');

      const status2 = await v.status([{ id: 'foo', name: 'Foo', content: 'bar' }]);
      expect(status2).toEqual({ stage: {}, unstaged: {} });
    });
  });

  describe('stage()', () => {
    it('stages entity', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status = await v.status([
        { id: 'foo', name: 'Foo', content: 'bar' },
        { id: 'baz', name: 'Baz', content: 'qux' },
      ]);

      const stage = await v.stage(status.unstaged['foo']);
      expect(stage).toEqual({
        foo: {
          id: 'foo',
          name: 'Foo',
          content: 'bar',
          hash: 'bdb2d8e7caa188ed5cb1b0295f65ce5e242b4324',
          operation: 'add',
        },
      });

      const status2 = await v.status([
        { id: 'foo', name: 'Foo', content: 'bar' },
        { id: 'baz', name: 'Baz', content: 'qux' },
      ]);
      expect(status2).toEqual({
        stage: {
          foo: {
            name: 'Foo',
            id: 'foo',
            content: 'bar',
            hash: 'bdb2d8e7caa188ed5cb1b0295f65ce5e242b4324',
            operation: 'add',
          },
        },
        unstaged: {
          baz: {
            id: 'baz',
            name: 'Baz',
            content: 'qux',
            hash: '297880f41344b3d6712a26c3af39874aee73e68a',
            operation: 'add',
          },
        },
      });
    });
  });

  describe('commit()', () => {
    it('commits basic entity', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status = await v.status([{ id: 'foo', name: 'Foo', content: 'bar' }]);
      await v.stage(status.unstaged['foo']);
      const { commit, tree } = await v.commit('Add foo');

      const history = await v.getHistory();
      expect(history[1]).toEqual({
        id: 'f548a2f5e500a7feeedcee332e7239e04cb38687',
        author: 'acct_123',
        message: 'Initial commit',
        parent: '0000000000000000000000000000000000000000',
        timestamp: 1000000000000,
        tree: '0000000000000000000000000000000000000000',
      });

      expect(commit).toEqual({
        id: 'c2c3c9dfbef32e6e2c5291bb011c4cc70d10f679',
        author: 'acct_123',
        message: 'Add foo',
        parent: 'f548a2f5e500a7feeedcee332e7239e04cb38687',
        timestamp: 1000000000001,
        tree: '197aa2df26bffbc250c615c0463c0ee9fbc3e117',
      });

      expect(tree).toEqual({
        foo: {
          name: 'Foo',
          hash: 'bdb2d8e7caa188ed5cb1b0295f65ce5e242b4324',
        },
      });
    });

    it('commits deleted entity', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status = await v.status([{ id: 'foo', name: 'Foo', content: 'bar' }]);
      await v.stage(status.unstaged['foo']);
      const { commit, tree } = await v.commit('Add foo');

      const history = await v.getHistory();
      expect(history[1]).toEqual({
        id: 'f548a2f5e500a7feeedcee332e7239e04cb38687',
        author: 'acct_123',
        message: 'Initial commit',
        parent: '0000000000000000000000000000000000000000',
        timestamp: 1000000000000,
        tree: '0000000000000000000000000000000000000000',
      });

      expect(commit).toEqual({
        id: 'c2c3c9dfbef32e6e2c5291bb011c4cc70d10f679',
        author: 'acct_123',
        message: 'Add foo',
        parent: 'f548a2f5e500a7feeedcee332e7239e04cb38687',
        timestamp: 1000000000001,
        tree: '197aa2df26bffbc250c615c0463c0ee9fbc3e117',
      });

      expect(tree).toEqual({
        foo: {
          name: 'Foo',
          hash: 'bdb2d8e7caa188ed5cb1b0295f65ce5e242b4324',
        },
      });

      const status2 = await v.status([]);
      await v.stage(status2.unstaged['foo']);
      const { commit: commit2, tree: tree2 } = await v.commit('Delete foo');

      expect(commit2).toEqual({
        id: '0986e841d010685a430931e198e336bfb6d49129',
        author: 'acct_123',
        message: 'Delete foo',
        parent: commit.id,
        timestamp: 1000000000002,
        tree: 'bf21a9e8fbc5a3846fb05b4fa0859e0917b2202f',
      });

      expect(tree2).toEqual({});
    });
  });

  describe('getHistory()', () => {
    it('sorts correctly by date DESC', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status1 = await v.status([{ id: 'foo', name: 'Foo', content: 'bar' }]);
      await v.stage(status1.unstaged['foo']);
      const { commit: commit1 } = await v.commit('Add foo');

      const status2 = await v.status([{ id: 'foo', name: 'Foo', content: 'bar 2' }]);
      await v.stage(status2.unstaged['foo']);
      const { commit: commit2 } = await v.commit('Modify foo');

      const history = await v.getHistory();
      expect(history[0].id).toBe(commit2.id);
      expect(history[1].id).toBe(commit1.id);
    });
  });

  describe('getBranches()', () => {
    it('lists branches', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      await v.checkout('branch-1');
      await v.checkout('branch-2');

      const branches = await v.getBranches();
      expect(branches).toEqual(['branch-1', 'branch-2', 'master']);
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
      const status1 = await v.status([{ id: 'foo', name: 'Foo', content: 'bar' }]);
      await v.stage(status1.unstaged['foo']);
      await v.commit('Add foo');

      // Checkout branch
      await v.checkout('new-branch');
      expect(await v.getBranches()).toEqual(['master', 'new-branch']);

      // Back to master and delete other branch
      await v.checkout('master');
      await v.removeBranch('new-branch');
      expect(await v.getBranches()).toEqual(['master']);
    });
  });

  describe('checkout()', () => {
    it('creates a new branch', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      // Add something to master
      const status1 = await v.status([{ id: 'foo', name: 'Foo', content: 'bar' }]);
      await v.stage(status1.unstaged['foo']);
      await v.commit('Add foo');

      // Checkout branch
      await v.checkout('new-branch');
      const history = await v.getHistory();
      expect(await v.getBranch()).toBe('new-branch');
      expect(history).toEqual([
        {
          author: 'acct_123',
          id: '534ab31d04dc96b9f40a608955c5a5d3ee82f886',
          parent: '0000000000000000000000000000000000000000',
          message: 'Create branch from master',
          timestamp: 1000000000002,
          tree: '197aa2df26bffbc250c615c0463c0ee9fbc3e117',
        },
      ]);
    });
  });

  // TODO: This is a
  //   multiline to-do
  // Woo!

  const name = 'merge()';
  describe(name, () => {
    it('does not merge if trees are the same', async () => {
      throw new Error('Fix me');
    });

    it('does something', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      // Add a file to master
      expect(await v.getBranch()).toBe('master');
      const status1 = await v.status([{ id: 'a', name: 'A', content: 'aaa' }]);
      await v.stage(status1.unstaged['a']);
      await v.commit('Add A');
      expect(await v.getHistory()).toEqual([
        {
          author: 'acct_123',
          id: '0baa0a746ac4fd75199adc181989b98194e09a3c',
          parent: 'f548a2f5e500a7feeedcee332e7239e04cb38687',
          message: 'Add A',
          timestamp: 1000000000001,
          tree: 'f2456325eec34054c836787d49b51b4e4cb1237b',
        },
        {
          author: 'acct_123',
          id: 'f548a2f5e500a7feeedcee332e7239e04cb38687',
          parent: '0000000000000000000000000000000000000000',
          message: 'Initial commit',
          timestamp: 1000000000000,
          tree: '0000000000000000000000000000000000000000',
        },
      ]);

      // Checkout new branch and add file
      await v.checkout('new-branch');
      expect(await v.getBranch()).toBe('new-branch');
      const status2 = await v.status([{ id: 'b', name: 'B', content: 'bbb' }]);
      await v.stage(status2.unstaged['b']);
      await v.commit('Add B');
      expect(await v.getHistory()).toEqual([
        {
          author: 'acct_123',
          id: 'e608dab8e4761234dcb5dcbe2b71a4bc54bf55e4',
          parent: '61d65017125915f4adf1307e851b70d82a8c0d5c',
          message: 'Add B',
          timestamp: 1000000000003,
          tree: '64f6bd5979919970e524ff433daa4ff65c8e92a3',
        },
        {
          author: 'acct_123',
          id: '61d65017125915f4adf1307e851b70d82a8c0d5c',
          parent: '0000000000000000000000000000000000000000',
          message: 'Create branch from master',
          timestamp: 1000000000002,
          tree: 'f2456325eec34054c836787d49b51b4e4cb1237b',
        },
      ]);

      // Merge new branch back into master
      await v.checkout('master');
      expect(await v.getBranch()).toBe('master');
      await v.merge('new-branch');
      expect(await v.getHistory()).toEqual([
        {
          author: 'acct_123',
          id: '702939bf3881024814d73b06a5b6ded56a8ad2cd',
          parent: '0baa0a746ac4fd75199adc181989b98194e09a3c',
          message: 'Merge new-branch',
          timestamp: 1000000000004,
          tree: '64f6bd5979919970e524ff433daa4ff65c8e92a3',
        },
        {
          author: 'acct_123',
          id: '0baa0a746ac4fd75199adc181989b98194e09a3c',
          parent: 'f548a2f5e500a7feeedcee332e7239e04cb38687',
          message: 'Add A',
          timestamp: 1000000000001,
          tree: 'f2456325eec34054c836787d49b51b4e4cb1237b',
        },
        {
          author: 'acct_123',
          id: 'f548a2f5e500a7feeedcee332e7239e04cb38687',
          parent: '0000000000000000000000000000000000000000',
          message: 'Initial commit',
          timestamp: 1000000000000,
          tree: '0000000000000000000000000000000000000000',
        },
      ]);
    });
  });

  describe('integration examples', () => {
    it('stores entities after commit', async () => {
      const v = new VCS('wrk_1', new MemoryDriver());
      await v.checkout('master');

      const status = await v.status([{ id: 'foo', name: 'Foo', content: 'bar' }]);
      await v.stage(status.unstaged['foo']);
      const { commit, tree } = await v.commit('Add foo');

      const foo = await v.getBlob(tree['foo'].hash);
      expect(foo).toBe('bar');
    });
  });
});
