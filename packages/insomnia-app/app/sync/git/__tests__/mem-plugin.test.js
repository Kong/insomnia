import { assertAsyncError, setupDateMocks } from './util';
import { MemPlugin } from '../mem-plugin';

describe('MemPlugin', () => {
  beforeEach(setupDateMocks);

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
      await assertAsyncError(p.readdir('/foo.txt'), 'ENOTDIR');
    });

    it('errors on missing directory', async () => {
      const p = new MemPlugin();
      await assertAsyncError(p.readdir('/invalid'), 'ENOENT');
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
