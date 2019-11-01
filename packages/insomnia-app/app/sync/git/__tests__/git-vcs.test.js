import GitVCS from '../git-vcs';
import { setupDateMocks } from './util';
import { MemPlugin } from '../mem-plugin';

describe('Git-VCS', () => {
  beforeEach(setupDateMocks);

  describe('status', () => {
    it('does the thing', async () => {
      const vcs = new GitVCS();
      await vcs.init('/', MemPlugin.createPlugin());
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      const files = await vcs.status();
      expect(files).toEqual({
        hasChanges: false,
        allStaged: true,
        allUnstaged: true,
        entries: [],
      });
    });
  });

  describe('playing around', () => {
    it('does the thing', async () => {
      const fs = MemPlugin.createPlugin();

      const vcs = new GitVCS();
      await vcs.init('/', fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      // No files exist yet
      const files1 = await vcs.listFiles();
      expect(files1).toEqual([]);

      await fs.promises.writeFile('/foo.txt', 'bar');
      const files2 = await vcs.listFiles();
      expect(files2).toEqual([]);
    });

    it('stage and unstage file', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir('/.studio');
      await fs.promises.writeFile('/.studio/foo.txt', 'foo');
      await fs.promises.writeFile('/.studio/bar.txt', 'bar');

      // Files outside .studio should be ignored
      await fs.promises.writeFile('/other.txt', 'other');

      const vcs = new GitVCS();
      await vcs.init('/', fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      expect(await vcs.status()).toEqual({
        allStaged: false,
        hasChanges: true,
        allUnstaged: true,
        entries: [
          { path: '.studio/bar.txt', status: '*added' },
          {
            path: '.studio/foo.txt',
            status: '*added',
          },
        ],
      });

      await vcs.add('.studio/foo.txt');
      expect(await vcs.status()).toEqual({
        allStaged: false,
        hasChanges: true,
        allUnstaged: false,
        entries: [
          { path: '.studio/bar.txt', status: '*added' },
          {
            path: '.studio/foo.txt',
            status: 'added',
          },
        ],
      });

      await vcs.remove('.studio/foo.txt');
      expect(await vcs.status()).toEqual({
        allStaged: false,
        hasChanges: true,
        allUnstaged: true,
        entries: [
          { path: '.studio/bar.txt', status: '*added' },
          {
            path: '.studio/foo.txt',
            status: '*added',
          },
        ],
      });
    });

    it('Returns empty log without first commit', async () => {
      const fs = MemPlugin.createPlugin();
      const vcs = new GitVCS();
      await vcs.init('/', fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      expect(await vcs.log()).toEqual([]);
    });

    it('commit file', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir('/.studio');
      await fs.promises.writeFile('/.studio/foo.txt', 'foo');
      await fs.promises.writeFile('/.studio/bar.txt', 'bar');

      await fs.promises.writeFile('/other.txt', 'should be ignored');

      const vcs = new GitVCS();
      await vcs.init('/', fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');
      await vcs.add('.studio/foo.txt');
      await vcs.commit('First commit!');

      expect(await vcs.status()).toEqual({
        allStaged: false,
        hasChanges: true,
        allUnstaged: true,
        entries: [
          { path: '.studio/bar.txt', status: '*added' },
          {
            path: '.studio/foo.txt',
            status: 'unmodified',
          },
        ],
      });

      expect(await vcs.log()).toEqual([
        {
          author: {
            email: 'karen@example.com',
            name: 'Karen Brown',
            timestamp: 1000000000,
            timezoneOffset: 0,
          },
          committer: {
            email: 'karen@example.com',
            name: 'Karen Brown',
            timestamp: 1000000000,
            timezoneOffset: 0,
          },
          message: 'First commit!\n',
          oid: 'b26d7e19ec581f90317d00085960735052abf5f0',
          parent: [],
          tree: '257d1b410966994eb8b79e004c679c26f72794c9',
        },
      ]);

      await fs.promises.unlink('/.studio/foo.txt');
      expect(await vcs.status()).toEqual({
        allStaged: false,
        hasChanges: true,
        allUnstaged: true,
        entries: [
          { path: '.studio/bar.txt', status: '*added' },
          { path: '.studio/foo.txt', status: '*deleted' },
        ],
      });

      await vcs.remove('.studio/foo.txt');
      expect(await vcs.status()).toEqual({
        allStaged: false,
        hasChanges: true,
        allUnstaged: false,
        entries: [
          { path: '.studio/bar.txt', status: '*added' },
          { path: '.studio/foo.txt', status: 'deleted' },
        ],
      });

      await vcs.remove('.studio/foo.txt');
      expect(await vcs.status()).toEqual({
        allStaged: false,
        hasChanges: true,
        allUnstaged: false,
        entries: [
          { path: '.studio/bar.txt', status: '*added' },
          { path: '.studio/foo.txt', status: 'deleted' },
        ],
      });
    });

    it('create branch', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir('/.studio');
      await fs.promises.writeFile('/.studio/foo.txt', 'foo');
      await fs.promises.writeFile('/.studio/bar.txt', 'bar');

      const vcs = new GitVCS();
      await vcs.init('/', fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');
      await vcs.add('.studio/foo.txt');
      await vcs.commit('First commit!');

      expect((await vcs.log()).length).toBe(1);

      await vcs.checkout('new-branch');
      expect((await vcs.log()).length).toBe(1);
      await vcs.add('.studio/bar.txt');
      await vcs.commit('Second commit!');
      expect((await vcs.log()).length).toBe(2);

      await vcs.checkout('master');
      expect((await vcs.log()).length).toBe(1);
    });
  });

  describe('readObjectFromTree()', () => {
    it('reads an object from tree', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir('/.studio');
      await fs.promises.mkdir('/.studio/dir');
      await fs.promises.writeFile('/.studio/dir/foo.txt', 'foo');

      const vcs = new GitVCS();
      await vcs.init('/', fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      await vcs.add('.studio/dir/foo.txt');
      await vcs.commit('First');

      await fs.promises.writeFile('.studio//dir/foo.txt', 'foo bar');
      await vcs.add('.studio/dir/foo.txt');
      await vcs.commit('Second');

      const log = await vcs.log();
      expect(await vcs.readObjFromTree(log[0].tree, '.studio/dir/foo.txt')).toBe('foo bar');
      expect(await vcs.readObjFromTree(log[1].tree, '.studio/dir/foo.txt')).toBe('foo');

      // Some extra checks
      expect(await vcs.readObjFromTree(log[1].tree, 'missing')).toBe(null);
      expect(await vcs.readObjFromTree('missing', 'missing')).toBe(null);
    });
  });
});
