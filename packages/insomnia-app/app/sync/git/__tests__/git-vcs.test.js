import GitVCS from '../git-vcs';
import { setupDateMocks } from './util';
import { MemPlugin } from '../mem-plugin';
import path from 'path';

const sep = path.sep;

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

      await fs.promises.writeFile(`${sep}foo.txt`, 'bar');
      const files2 = await vcs.listFiles();
      expect(files2).toEqual([]);
    });

    it('stage and unstage file', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir(`${sep}.studio`);
      await fs.promises.writeFile(`${sep}.studio${sep}foo.txt`, 'foo');
      await fs.promises.writeFile(`${sep}.studio${sep}bar.txt`, 'bar');

      // Files outside .studio should be ignored
      await fs.promises.writeFile(`${sep}other.txt`, 'other');

      const vcs = new GitVCS();
      await vcs.init(sep, fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      expect(await vcs.status(`.studio${sep}bar.txt`)).toBe('*added');
      expect(await vcs.status(`.studio${sep}foo.txt`)).toBe('*added');

      await vcs.add(`.studio${sep}foo.txt`);
      expect(await vcs.status(`.studio${sep}bar.txt`)).toBe('*added');
      expect(await vcs.status(`.studio${sep}foo.txt`)).toBe('added');

      await vcs.remove(`.studio${sep}foo.txt`);
      expect(await vcs.status(`.studio${sep}bar.txt`)).toBe('*added');
      expect(await vcs.status(`.studio${sep}foo.txt`)).toBe('*added');
    });

    it('Returns empty log without first commit', async () => {
      const fs = MemPlugin.createPlugin();
      const vcs = new GitVCS();
      await vcs.init(sep, fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      expect(await vcs.log()).toEqual([]);
    });

    it('commit file', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir(`${sep}.studio`);
      await fs.promises.writeFile(`${sep}.studio${sep}foo.txt`, 'foo');
      await fs.promises.writeFile(`${sep}.studio${sep}bar.txt`, 'bar');

      await fs.promises.writeFile(`${sep}other.txt`, 'should be ignored');

      const vcs = new GitVCS();
      await vcs.init(`${sep}`, fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');
      await vcs.add(`.studio${sep}foo.txt`);
      await vcs.commit('First commit!');

      expect(await vcs.status(`.studio${sep}bar.txt`)).toBe('*added');
      expect(await vcs.status(`.studio${sep}foo.txt`)).toBe('unmodified');

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

      await fs.promises.unlink(`${sep}.studio${sep}foo.txt`);
      expect(await vcs.status(`.studio${sep}bar.txt`)).toBe('*added');
      expect(await vcs.status(`.studio${sep}foo.txt`)).toBe('*deleted');

      await vcs.remove(`.studio${sep}foo.txt`);
      expect(await vcs.status(`.studio${sep}bar.txt`)).toBe('*added');
      expect(await vcs.status(`.studio${sep}foo.txt`)).toBe('deleted');

      await vcs.remove(`.studio${sep}foo.txt`);
      expect(await vcs.status(`.studio${sep}bar.txt`)).toBe('*added');
      expect(await vcs.status(`.studio${sep}foo.txt`)).toBe('deleted');
    });

    it('create branch', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir(`${sep}.studio`);
      await fs.promises.writeFile(`${sep}.studio${sep}foo.txt`, 'foo');
      await fs.promises.writeFile(`${sep}.studio${sep}bar.txt`, 'bar');

      const vcs = new GitVCS();
      await vcs.init(sep, fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');
      await vcs.add(`.studio${sep}foo.txt`);
      await vcs.commit('First commit!');

      expect((await vcs.log()).length).toBe(1);

      await vcs.checkout('new-branch');
      expect((await vcs.log()).length).toBe(1);
      await vcs.add(`.studio${sep}bar.txt`);
      await vcs.commit('Second commit!');
      expect((await vcs.log()).length).toBe(2);

      await vcs.checkout('master');
      expect((await vcs.log()).length).toBe(1);
    });
  });

  describe('readObjectFromTree()', () => {
    it('reads an object from tree', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir(`${sep}.studio`);
      await fs.promises.mkdir(`${sep}.studio${sep}dir`);
      await fs.promises.writeFile(`${sep}.studio${sep}dir${sep}foo.txt`, 'foo');

      const vcs = new GitVCS();
      await vcs.init(sep, fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      await vcs.add(`.studio${sep}dir${sep}foo.txt`);
      await vcs.commit('First');

      await fs.promises.writeFile(`.studio${sep}${sep}dir${sep}foo.txt`, 'foo bar');
      await vcs.add(`.studio${sep}dir${sep}foo.txt`);
      await vcs.commit('Second');

      const log = await vcs.log();
      expect(await vcs.readObjFromTree(log[0].tree, `.studio${sep}dir${sep}foo.txt`)).toBe('foo bar');
      expect(await vcs.readObjFromTree(log[1].tree, `.studio${sep}dir${sep}foo.txt`)).toBe('foo');

      // Some extra checks
      expect(await vcs.readObjFromTree(log[1].tree, 'missing')).toBe(null);
      expect(await vcs.readObjFromTree('missing', 'missing')).toBe(null);
    });
  });
});
