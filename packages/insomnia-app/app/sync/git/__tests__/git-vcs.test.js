import GitVCS, { MemPlugin } from '../git-vcs';

const AUTHOR = {
  name: 'Karen Brown',
  email: 'karen@example.com',
};

describe('Git-VCS', () => {
  beforeEach(() => {
    let ts = 1000000000000;

    class fakeDate extends Date {
      constructor(arg) {
        if (!arg) {
          return new Date(ts++);
        } else {
          super(arg);
        }
      }

      getTimezoneOffset() {
        return 0;
      }

      static now() {
        return new Date().getTime();
      }
    }

    global.Date = fakeDate;
  });

  describe('status', () => {
    it('does the thing', async () => {
      const vcs = new GitVCS();
      await vcs.init('/', MemPlugin.createPlugin());

      const files = await vcs.status();
      expect(files).toEqual([]);
    });
  });

  describe('playing around', () => {
    it('does the thing', async () => {
      const fs = MemPlugin.createPlugin();

      const vcs = new GitVCS();
      await vcs.init('/', fs);

      // No files exist yet
      const files1 = await vcs.listFiles();
      expect(files1).toEqual([]);

      await fs.promises.writeFile('/foo.txt', 'bar');
      const files2 = await vcs.listFiles();
      expect(files2).toEqual([]);
    });

    it('stage and unstage file', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.writeFile('/foo.txt', 'foo');
      await fs.promises.writeFile('/bar.txt', 'bar');

      const vcs = new GitVCS();
      await vcs.init('/', fs);
      expect(await vcs.status()).toEqual([['bar.txt', 0, 2, 0], ['foo.txt', 0, 2, 0]]);

      await vcs.add('foo.txt');

      expect(await vcs.status()).toEqual([['bar.txt', 0, 2, 0], ['foo.txt', 0, 2, 2]]);

      await vcs.remove('foo.txt');

      expect(await vcs.status()).toEqual([['bar.txt', 0, 2, 0], ['foo.txt', 0, 2, 0]]);
    });

    it('commit file', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.writeFile('/foo.txt', 'foo');
      await fs.promises.writeFile('/bar.txt', 'bar');

      const vcs = new GitVCS();
      await vcs.init('/', fs);
      await vcs.add('foo.txt');
      await vcs.commit('First commit!', AUTHOR);

      expect(await vcs.status()).toEqual([['bar.txt', 0, 2, 0], ['foo.txt', 1, 1, 1]]);

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
          oid: '3f2c080f624720a716893fb17f221a49fc7f70f5',
          parent: [],
          tree: '95d3aa5f7462c052c821f8fe976c506c94946d68',
        },
      ]);
    });

    it('create branch', async () => {
      const fs = MemPlugin.createPlugin();
      await fs.promises.writeFile('/foo.txt', 'foo');
      await fs.promises.writeFile('/bar.txt', 'bar');

      const vcs = new GitVCS();
      await vcs.init('/', fs);
      await vcs.add('foo.txt');
      await vcs.commit('First commit!', AUTHOR);

      expect((await vcs.log()).length).toBe(1);

      await vcs.checkout('new-branch');
      expect((await vcs.log()).length).toBe(1);
      await vcs.add('bar.txt');
      await vcs.commit('Second commit!', AUTHOR);
      expect((await vcs.log()).length).toBe(2);

      await vcs.checkout('master');
      expect((await vcs.log()).length).toBe(1);
    });
  });
});

describe('MemPlugin', () => {
  beforeEach(() => {
    let ts = 1000000000000;
    Date.now = jest.fn(() => ts++);
  });

  describe('readfile()', () => {
    it('fails to read', async () => {
      const p = new MemPlugin();
      await assertAsyncError(p.readFile('/foo.txt'), 'ENOENT');
    });

    it('reads a file', async () => {
      const p = new MemPlugin();
      await p.writeFile('/foo.txt', 'Hello World!');
      expect((await p.readFile('/foo.txt')).toString()).toBe('Hello World!');
    });
  });

  describe('writeFile()', () => {
    it('fails to write over directory', async () => {
      const p = new MemPlugin();

      await p.mkdir('/foo');
      await assertAsyncError(p.writeFile('/foo', 'Hello World 2!'), 'EISDIR');
    });

    it('overwrites file', async () => {
      const p = new MemPlugin();

      await p.writeFile('/foo.txt', 'Hello World!');
      await p.writeFile('/foo.txt', 'Hello World 2!');
      expect((await p.readFile('/foo.txt')).toString()).toBe('Hello World 2!');
    });

    it('flag "a" file', async () => {
      const p = new MemPlugin();

      await p.writeFile('/foo.txt', 'Hello World!', { flag: 'a' });
      await p.writeFile('/foo.txt', 'xxx', { flag: 'a' });
      expect((await p.readFile('/foo.txt')).toString()).toBe('Hello World!xxx');
    });

    it('flags "ax" and "wx" fail if path exists', async () => {
      const p = new MemPlugin();

      await p.writeFile('/foo.txt', 'Hello World!');
      await assertAsyncError(p.writeFile('/foo.txt', 'aaa', { flag: 'ax' }), 'EEXIST');
      await assertAsyncError(p.writeFile('/foo.txt', 'aaa', { flag: 'wx' }), 'EEXIST');
    });

    it('fails if flag "r"', async () => {
      const p = new MemPlugin();
      await assertAsyncError(p.writeFile('/foo.txt', 'aaa', { flag: 'r' }), 'EBADF');
    });

    it('fails if dir missing', async () => {
      const p = new MemPlugin();

      await assertAsyncError(p.writeFile('/foo.txt', 'aaa', { flag: 'r' }), 'EBADF');
    });

    it('works with flags', async () => {
      const p = new MemPlugin();

      await p.writeFile('/foo.txt', 'Hello World!', { flag: 'a' });
      await p.writeFile('/foo.txt', 'xxx', { flag: 'a' });
      expect((await p.readFile('/foo.txt')).toString()).toBe('Hello World!xxx');
    });
  });

  describe('unlink()', () => {
    it('unlinks file', async () => {
      const p = new MemPlugin();

      await p.writeFile('/foo.txt', 'xxx');
      await p.unlink('/foo.txt');
      await assertAsyncError(p.readFile('/foo.txt'), 'ENOENT');
    });

    it('fails to unlinks missing file', async () => {
      const p = new MemPlugin();

      await assertAsyncError(p.unlink('/not/exist.txt'), 'ENOENT');
    });
  });

  describe('readdir()', () => {
    it('lists dir', async () => {
      const p = new MemPlugin();

      // Root dir should always exist
      expect(await p.readdir('/')).toEqual([]);

      // Write a file and list it again
      await p.writeFile('/foo.txt', 'Hello World!');
      await p.writeFile('/bar.txt', 'Bar!');
      expect(await p.readdir('/')).toEqual(['bar.txt', 'foo.txt']);
    });

    it('errors on file', async () => {
      const p = new MemPlugin();
      await p.writeFile('/foo.txt', 'Bar!');

      let message = false;
      try {
        await p.readdir('/foo.txt');
      } catch (e) {
        message = e.message;
      }

      expect(message).toBe(`ENOTDIR: not a directory, scandir '/foo.txt'`);
    });

    it('errors on missing directory', async () => {
      const p = new MemPlugin();

      let message = false;
      try {
        await p.readdir('/invalid');
      } catch (e) {
        message = e.message;
      }

      expect(message).toBe(`ENOENT: no such file or directory, scandir '/invalid'`);
    });
  });

  describe('mkdir()', () => {
    it('creates directory', async () => {
      const p = new MemPlugin();

      await p.mkdir('/foo');
      await p.mkdir('/foo/bar');

      expect(await p.readdir('/')).toEqual(['foo']);
      expect(await p.readdir('/foo')).toEqual(['bar']);
    });

    it('creates directory recursively', async () => {
      const p = new MemPlugin();

      await p.mkdir('/foo/bar/baz', { recursive: true });
      expect(await p.readdir('/foo/bar/baz')).toEqual([]);
    });

    it('fails to create if no parent', async () => {
      const p = new MemPlugin();

      await assertAsyncError(p.mkdir('/foo/bar/baz'), 'ENOENT');
    });
  });

  describe('rmdir()', () => {
    it('removes a dir', async () => {
      const p = new MemPlugin();

      await p.mkdir('/a/b/c', { recursive: true });
      expect(await p.readdir('/a/b')).toEqual(['c']);
      await p.rmdir('/a/b/c');
      expect(await p.readdir('/a/b')).toEqual([]);
    });

    it('fails on non-empty dir', async () => {
      const p = new MemPlugin();

      await p.mkdir('/a/b/c', { recursive: true });
      await p.writeFile('/a/b/c/foo.txt', 'xxx');

      await assertAsyncError(p.rmdir('/a/b'), 'ENOTEMPTY');
      await assertAsyncError(p.rmdir('/a/b/c'), 'ENOTEMPTY');
    });

    it('fails on file', async () => {
      const p = new MemPlugin();

      await p.writeFile('/foo.txt', 'xxx');
      await assertAsyncError(p.rmdir('/foo.txt'), 'ENOTDIR');
    });
  });

  describe('stat()', () => {
    it('stats root dir', async () => {
      const p = new MemPlugin();

      const stat = await p.stat('/');

      expect(stat).toEqual({
        ctimeMs: 1000000000000,
        mtimeMs: 1000000000000,
        dev: 1,
        gid: 1,
        ino: 0,
        mode: 0o777,
        size: 0,
        type: 'dir',
        uid: 1,
      });

      expect(stat.isDirectory()).toBe(true);
      expect(stat.isFile()).toBe(false);
      expect(stat.isSymbolicLink()).toBe(false);
    });

    it('stats file', async () => {
      const p = new MemPlugin();

      await p.writeFile('/foo.txt', 'xxx');
      const stat = await p.stat('/foo.txt');

      expect(stat).toEqual({
        ctimeMs: 1000000000001,
        mtimeMs: 1000000000001,
        dev: 1,
        gid: 1,
        ino: 0,
        mode: 0o777,
        size: 4,
        type: 'file',
        uid: 1,
      });

      expect(stat.isDirectory()).toBe(false);
      expect(stat.isFile()).toBe(true);
      expect(stat.isSymbolicLink()).toBe(false);
    });

    it('fails to stat missing', async () => {
      const p = new MemPlugin();
      await assertAsyncError(p.stat('/bar.txt'), 'ENOENT');
    });
  });
});

async function assertAsyncError(promise, code) {
  try {
    await promise;
  } catch (err) {
    expect(err.message).toMatch(new RegExp(`^${code}.+`));
    expect(err.code).toBe(code);
    expect(typeof err.syscall).toBe('string');
    expect(typeof err.path).toBe('string');
    return;
  }

  throw new Error(`Promise did not throw`);
}
