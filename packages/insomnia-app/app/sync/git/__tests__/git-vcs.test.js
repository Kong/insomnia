import GitVCS, { GIT_CLONE_DIR, GIT_INSOMNIA_DIR } from '../git-vcs';
import { setupDateMocks } from './util';
import { MemPlugin } from '../mem-plugin';
import path from 'path';
jest.mock('path');

describe.each(['win32', 'posix'])('Git-VCS using path.%s', type => {
  let fooTxt = '';
  let barTxt = '';
  beforeAll(() => {
    path.__mockPath(type);
    fooTxt = path.join(GIT_INSOMNIA_DIR, 'foo.txt');
    barTxt = path.join(GIT_INSOMNIA_DIR, 'bar.txt');
  });

  afterAll(() => jest.restoreAllMocks());
  beforeEach(setupDateMocks);

  describe('common operations', () => {
    it('listFiles()', async () => {
      const fs = MemPlugin.createPlugin();

      const vcs = new GitVCS();
      await vcs.init(GIT_CLONE_DIR, fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      // No files exist yet
      const files1 = await vcs.listFiles();
      expect(files1).toEqual([]);

      // File does not exist in git index
      await fs.promises.writeFile('foo.txt', 'bar');
      const files2 = await vcs.listFiles();
      expect(files2).toEqual([]);
    });

    it('stage and unstage file', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir(GIT_INSOMNIA_DIR);
      await fs.promises.writeFile(fooTxt, 'foo');
      await fs.promises.writeFile(barTxt, 'bar');

      // Files outside namespace should be ignored
      await fs.promises.writeFile('/other.txt', 'other');

      const vcs = new GitVCS();
      await vcs.init(GIT_CLONE_DIR, fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      expect(await vcs.status(barTxt)).toBe('*added');
      expect(await vcs.status(fooTxt)).toBe('*added');

      await vcs.add(fooTxt);
      expect(await vcs.status(barTxt)).toBe('*added');
      expect(await vcs.status(fooTxt)).toBe('added');

      await vcs.remove(fooTxt);
      expect(await vcs.status(barTxt)).toBe('*added');
      expect(await vcs.status(fooTxt)).toBe('*added');
    });

    it('Returns empty log without first commit', async () => {
      const fs = MemPlugin.createPlugin();
      const vcs = new GitVCS();
      await vcs.init(GIT_CLONE_DIR, fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      expect(await vcs.log()).toEqual([]);
    });

    it('commit file', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir(GIT_INSOMNIA_DIR);
      await fs.promises.writeFile(fooTxt, 'foo');
      await fs.promises.writeFile(barTxt, 'bar');

      await fs.promises.writeFile('other.txt', 'should be ignored');

      const vcs = new GitVCS();
      await vcs.init(GIT_CLONE_DIR, fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');
      await vcs.add(fooTxt);
      await vcs.commit('First commit!');

      expect(await vcs.status(barTxt)).toBe('*added');
      expect(await vcs.status(fooTxt)).toBe('unmodified');

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
          oid: '76f804a23eef9f52017bf93f4bc0bfde45ec8a93',
          parent: [],
          tree: '14819d8019f05edb70a29850deb09a4314ad0afc',
        },
      ]);

      await fs.promises.unlink(fooTxt);
      expect(await vcs.status(barTxt)).toBe('*added');
      expect(await vcs.status(fooTxt)).toBe('*deleted');

      await vcs.remove(fooTxt);
      expect(await vcs.status(barTxt)).toBe('*added');
      expect(await vcs.status(fooTxt)).toBe('deleted');

      await vcs.remove(fooTxt);
      expect(await vcs.status(barTxt)).toBe('*added');
      expect(await vcs.status(fooTxt)).toBe('deleted');
    });

    it('create branch', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir(GIT_INSOMNIA_DIR);
      await fs.promises.writeFile(fooTxt, 'foo');
      await fs.promises.writeFile(barTxt, 'bar');

      const vcs = new GitVCS();
      await vcs.init(GIT_CLONE_DIR, fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');
      await vcs.add(fooTxt);
      await vcs.commit('First commit!');

      expect((await vcs.log()).length).toBe(1);

      await vcs.checkout('new-branch');
      expect((await vcs.log()).length).toBe(1);
      await vcs.add(barTxt);
      await vcs.commit('Second commit!');
      expect((await vcs.log()).length).toBe(2);

      await vcs.checkout('master');
      expect((await vcs.log()).length).toBe(1);
    });
  });

  describe('undoPendingChanges()', () => {
    it('should remove pending changes from all tracked files', async () => {
      const folder = path.join(GIT_INSOMNIA_DIR, 'folder');
      const folderBarTxt = path.join(folder, 'bar.txt');
      const originalContent = 'content';

      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir(GIT_INSOMNIA_DIR);
      await fs.promises.writeFile(fooTxt, originalContent);

      await fs.promises.mkdir(folder);
      await fs.promises.writeFile(folderBarTxt, originalContent);

      const vcs = new GitVCS();
      await vcs.init(GIT_CLONE_DIR, fs);

      // Commit
      await vcs.setAuthor('Karen Brown', 'karen@example.com');
      await vcs.add(fooTxt);
      await vcs.add(folderBarTxt);
      await vcs.commit('First commit!');

      // Change the file
      await fs.promises.writeFile(fooTxt, 'changedContent');
      await fs.promises.writeFile(folderBarTxt, 'changedContent');
      expect(await vcs.status(fooTxt)).toBe('*modified');
      expect(await vcs.status(folderBarTxt)).toBe('*modified');

      // Undo
      await vcs.undoPendingChanges();

      // Ensure git doesn't recognize a change anymore
      expect(await vcs.status(fooTxt)).toBe('unmodified');
      expect(await vcs.status(folderBarTxt)).toBe('unmodified');

      // Expect original doc to have reverted
      expect((await fs.promises.readFile(fooTxt)).toString()).toBe(originalContent);
      expect((await fs.promises.readFile(folderBarTxt)).toString()).toBe(originalContent);
    });

    it('should remove pending changes from select tracked files', async () => {
      const foo1Txt = path.join(GIT_INSOMNIA_DIR, 'foo1.txt');
      const foo2Txt = path.join(GIT_INSOMNIA_DIR, 'foo2.txt');
      const foo3Txt = path.join(GIT_INSOMNIA_DIR, 'foo3.txt');
      const files = [foo1Txt, foo2Txt, foo3Txt];
      const originalContent = 'content';
      const changedContent = 'changedContent';

      const fs = MemPlugin.createPlugin();
      await fs.promises.mkdir(GIT_INSOMNIA_DIR);
      const vcs = new GitVCS();
      await vcs.init(GIT_CLONE_DIR, fs);

      // Write to all files
      await Promise.all(files.map(f => fs.promises.writeFile(f, originalContent)));

      // Commit all files
      await vcs.setAuthor('Karen Brown', 'karen@example.com');
      await Promise.all(files.map(f => vcs.add(f, originalContent)));
      await vcs.commit('First commit!');

      // Change all files
      await Promise.all(files.map(f => fs.promises.writeFile(f, changedContent)));
      await Promise.all(files.map(f => expect(vcs.status(foo1Txt)).resolves.toBe('*modified')));

      // Undo foo1 and foo2, but not foo3
      await vcs.undoPendingChanges([foo1Txt, foo2Txt]);

      expect(await vcs.status(foo1Txt)).toBe('unmodified');
      expect(await vcs.status(foo2Txt)).toBe('unmodified');

      // Expect original doc to have reverted for foo1 and foo2
      expect((await fs.promises.readFile(foo1Txt)).toString()).toBe(originalContent);
      expect((await fs.promises.readFile(foo2Txt)).toString()).toBe(originalContent);

      // Expect changed content for foo3
      expect(await vcs.status(foo3Txt)).toBe('*modified');
      expect((await fs.promises.readFile(foo3Txt)).toString()).toBe(changedContent);
    });
  });

  describe('readObjectFromTree()', () => {
    it('reads an object from tree', async () => {
      const fs = MemPlugin.createPlugin();
      const dir = path.join(GIT_INSOMNIA_DIR, 'dir');
      const dirFooTxt = path.join(dir, 'foo.txt');

      await fs.promises.mkdir(GIT_INSOMNIA_DIR);
      await fs.promises.mkdir(dir);
      await fs.promises.writeFile(dirFooTxt, 'foo');

      const vcs = new GitVCS();
      await vcs.init(GIT_CLONE_DIR, fs);
      await vcs.setAuthor('Karen Brown', 'karen@example.com');

      await vcs.add(dirFooTxt);
      await vcs.commit('First');

      await fs.promises.writeFile(dirFooTxt, 'foo bar');
      await vcs.add(dirFooTxt);
      await vcs.commit('Second');

      const log = await vcs.log();
      expect(await vcs.readObjFromTree(log[0].tree, dirFooTxt)).toBe('foo bar');
      expect(await vcs.readObjFromTree(log[1].tree, dirFooTxt)).toBe('foo');

      // Some extra checks
      expect(await vcs.readObjFromTree(log[1].tree, 'missing')).toBe(null);
      expect(await vcs.readObjFromTree('missing', 'missing')).toBe(null);
    });
  });
});
