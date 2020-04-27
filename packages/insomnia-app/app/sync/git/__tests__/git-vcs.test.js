import GitVCS, { GIT_NAMESPACE_DIR } from '../git-vcs';
import { setupDateMocks } from './util';
import { MemPlugin } from '../mem-plugin';

describe('Git-VCS', () => {
  beforeEach(setupDateMocks);

  describe('common operations', () => {
    it('listFiles()', async () => {
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
      await fs.promises.mkdir(`/${GIT_NAMESPACE_DIR}`);
      await fs.promises.writeFile(`/${GIT_NAMESPACE_DIR}/foo.txt`, 'foo');
      await fs.promises.writeFile(`/${GIT_NAMESPACE_DIR}/bar.txt`, 'bar');

      // Files outside namespace should be ignored
      await fs.promises.writeFile('/other.txt', 'other');

      const vcs = new GitVCS();
      await vcs.init('/', fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/bar.txt`)).toBe('*added');
      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/foo.txt`)).toBe('*added');

      await vcs.add(`${GIT_NAMESPACE_DIR}/foo.txt`);
      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/bar.txt`)).toBe('*added');
      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/foo.txt`)).toBe('added');

      await vcs.remove(`${GIT_NAMESPACE_DIR}/foo.txt`);
      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/bar.txt`)).toBe('*added');
      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/foo.txt`)).toBe('*added');
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
      await fs.promises.mkdir(`/${GIT_NAMESPACE_DIR}`);
      await fs.promises.writeFile(`/${GIT_NAMESPACE_DIR}/foo.txt`, 'foo');
      await fs.promises.writeFile(`/${GIT_NAMESPACE_DIR}/bar.txt`, 'bar');

      await fs.promises.writeFile('/other.txt', 'should be ignored');

      const vcs = new GitVCS();
      await vcs.init('/', fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');
      await vcs.add(`${GIT_NAMESPACE_DIR}/foo.txt`);
      await vcs.commit('First commit!');

      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/bar.txt`)).toBe('*added');
      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/foo.txt`)).toBe('unmodified');

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

      await fs.promises.unlink(`/${GIT_NAMESPACE_DIR}/foo.txt`);
      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/bar.txt`)).toBe('*added');
      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/foo.txt`)).toBe('*deleted');

      await vcs.remove(`${GIT_NAMESPACE_DIR}/foo.txt`);
      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/bar.txt`)).toBe('*added');
      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/foo.txt`)).toBe('deleted');

      await vcs.remove(`${GIT_NAMESPACE_DIR}/foo.txt`);
      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/bar.txt`)).toBe('*added');
      expect(await vcs.status(`${GIT_NAMESPACE_DIR}/foo.txt`)).toBe('deleted');
    });

    it('create branch', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir(`/${GIT_NAMESPACE_DIR}`);
      await fs.promises.writeFile(`/${GIT_NAMESPACE_DIR}/foo.txt`, 'foo');
      await fs.promises.writeFile(`/${GIT_NAMESPACE_DIR}/bar.txt`, 'bar');

      const vcs = new GitVCS();
      await vcs.init('/', fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');
      await vcs.add(`${GIT_NAMESPACE_DIR}/foo.txt`);
      await vcs.commit('First commit!');

      expect((await vcs.log()).length).toBe(1);

      await vcs.checkout('new-branch');
      expect((await vcs.log()).length).toBe(1);
      await vcs.add(`${GIT_NAMESPACE_DIR}/bar.txt`);
      await vcs.commit('Second commit!');
      expect((await vcs.log()).length).toBe(2);

      await vcs.checkout('master');
      expect((await vcs.log()).length).toBe(1);
    });
  });

  describe('readObjectFromTree()', () => {
    it('reads an object from tree', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir(`/${GIT_NAMESPACE_DIR}`);
      await fs.promises.mkdir(`/${GIT_NAMESPACE_DIR}/dir`);
      await fs.promises.writeFile(`/${GIT_NAMESPACE_DIR}/dir/foo.txt`, 'foo');

      const vcs = new GitVCS();
      await vcs.init('/', fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      await vcs.add(`${GIT_NAMESPACE_DIR}/dir/foo.txt`);
      await vcs.commit('First');

      await fs.promises.writeFile(`${GIT_NAMESPACE_DIR}//dir/foo.txt`, 'foo bar');
      await vcs.add(`${GIT_NAMESPACE_DIR}/dir/foo.txt`);
      await vcs.commit('Second');

      const log = await vcs.log();
      expect(await vcs.readObjFromTree(log[0].tree, `${GIT_NAMESPACE_DIR}/dir/foo.txt`)).toBe('foo bar');
      expect(await vcs.readObjFromTree(log[1].tree, `${GIT_NAMESPACE_DIR}/dir/foo.txt`)).toBe('foo');

      // Some extra checks
      expect(await vcs.readObjFromTree(log[1].tree, 'missing')).toBe(null);
      expect(await vcs.readObjFromTree('missing', 'missing')).toBe(null);
    });
  });
});
