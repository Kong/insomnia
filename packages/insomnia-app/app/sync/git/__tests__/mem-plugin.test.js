import { assertAsyncError, setupDateMocks } from './util';
import { MemPlugin } from '../mem-plugin';
import path from 'path';
import { GIT_CLONE_DIR } from '../git-vcs';
import { isWindows } from '../../../common/constants';
jest.mock('path');

const paths = isWindows() ? ['win32'] : ['win32', 'posix'];

describe.each([paths])('Memlugin using path.%s', type => {
  beforeAll(() => path.__mockPath(type));
  afterAll(() => jest.restoreAllMocks());
  beforeEach(setupDateMocks);

  const fooTxt = 'foo.txt';
  const barTxt = 'bar.txt';

  describe('readfile()', () => {
    it('fails to read', async () => {
      const p = new MemPlugin();
      await assertAsyncError(p.readFile(fooTxt), 'ENOENT');
    });

    it('reads a file', async () => {
      const p = new MemPlugin();
      await p.writeFile(fooTxt, 'Hello World!');
      expect((await p.readFile(fooTxt)).toString()).toBe('Hello World!');
    });
  });

  describe('writeFile()', () => {
    it('fails to write over directory', async () => {
      const p = new MemPlugin();
      const dirName = 'foo';

      await p.mkdir(dirName);
      await assertAsyncError(p.writeFile(dirName, 'Hello World 2!'), 'EISDIR');
    });

    it('overwrites file', async () => {
      const p = new MemPlugin();

      await p.writeFile(fooTxt, 'Hello World!');
      await p.writeFile(fooTxt, 'Hello World 2!');
      expect((await p.readFile(fooTxt)).toString()).toBe('Hello World 2!');
    });

    it('flag "a" file', async () => {
      const p = new MemPlugin();

      await p.writeFile(fooTxt, 'Hello World!', { flag: 'a' });
      await p.writeFile(fooTxt, 'xxx', { flag: 'a' });
      expect((await p.readFile(fooTxt)).toString()).toBe('Hello World!xxx');
    });

    it('flags "ax" and "wx" fail if path exists', async () => {
      const p = new MemPlugin();

      await p.writeFile(fooTxt, 'Hello World!');
      await assertAsyncError(p.writeFile(fooTxt, 'aaa', { flag: 'ax' }), 'EEXIST');
      await assertAsyncError(p.writeFile(fooTxt, 'aaa', { flag: 'wx' }), 'EEXIST');
    });

    it('fails if flag "r"', async () => {
      const p = new MemPlugin();
      await assertAsyncError(p.writeFile(fooTxt, 'aaa', { flag: 'r' }), 'EBADF');
    });

    it('fails if dir missing', async () => {
      const p = new MemPlugin();

      await assertAsyncError(p.writeFile(fooTxt, 'aaa', { flag: 'r' }), 'EBADF');
    });

    it('works with flags', async () => {
      const p = new MemPlugin();

      await p.writeFile(fooTxt, 'Hello World!', { flag: 'a' });
      await p.writeFile(fooTxt, 'xxx', { flag: 'a' });
      expect((await p.readFile(fooTxt)).toString()).toBe('Hello World!xxx');
    });
  });

  describe('unlink()', () => {
    it('unlinks file', async () => {
      const p = new MemPlugin();

      await p.writeFile(fooTxt, 'xxx');
      await p.unlink(fooTxt);
      await assertAsyncError(p.readFile(fooTxt), 'ENOENT');
    });

    it('fails to unlinks missing file', async () => {
      const p = new MemPlugin();

      await assertAsyncError(p.unlink(path.join('not', 'exist.txt')), 'ENOENT');
    });
  });

  describe('readdir()', () => {
    it('lists dir', async () => {
      const p = new MemPlugin();

      // Root dir should always exist
      expect(await p.readdir(GIT_CLONE_DIR)).toEqual([]);

      // Write a file and list it again
      await p.writeFile(fooTxt, 'Hello World!');
      await p.writeFile(barTxt, 'Bar!');
      expect(await p.readdir(GIT_CLONE_DIR)).toEqual(['bar.txt', 'foo.txt']);
    });

    it('errors on file', async () => {
      const p = new MemPlugin();
      await p.writeFile(fooTxt, 'Bar!');
      await assertAsyncError(p.readdir(fooTxt), 'ENOTDIR');
    });

    it('errors on missing directory', async () => {
      const p = new MemPlugin();
      await assertAsyncError(p.readdir(path.join('/', 'invalid')), 'ENOENT');
    });
  });

  describe('mkdir()', () => {
    const fooDir = 'foo';
    const fooBarDir = path.join(fooDir, 'bar');
    const cloneFooDir = path.join(GIT_CLONE_DIR, 'foo');
    const cloneFooBarDir = path.join(GIT_CLONE_DIR, 'foo', 'bar');
    const cloneFooBarBazDir = path.join(GIT_CLONE_DIR, 'foo', 'bar', 'baz');

    it('creates directory', async () => {
      const p = new MemPlugin();

      await p.mkdir(fooDir);
      await p.mkdir(fooBarDir);

      expect(await p.readdir(GIT_CLONE_DIR)).toEqual(['foo']);
      expect(await p.readdir(cloneFooDir)).toEqual(['bar']);
    });

    it('creates directory non-recursively', async () => {
      const p = new MemPlugin();

      await p.mkdir(cloneFooDir, { recursive: true });
      await p.mkdir(cloneFooBarDir);
      expect(await p.readdir(cloneFooBarDir)).toEqual([]);
    });

    it('creates directory recursively', async () => {
      const p = new MemPlugin();

      await p.mkdir(cloneFooBarBazDir, { recursive: true });
      expect(await p.readdir(cloneFooBarBazDir)).toEqual([]);
    });

    it('fails to create if no parent', async () => {
      const p = new MemPlugin();

      await assertAsyncError(p.mkdir(cloneFooBarBazDir), 'ENOENT');
    });
  });

  describe('rmdir()', () => {
    const abDir = path.join('a', 'b');
    const abcDir = path.join('a', 'b', 'c');

    it('removes a dir', async () => {
      const p = new MemPlugin();

      await p.mkdir(abcDir, { recursive: true });
      expect(await p.readdir(abDir)).toEqual(['c']);
      await p.rmdir(abcDir);
      expect(await p.readdir(abDir)).toEqual([]);
    });

    it('fails on non-empty dir', async () => {
      const p = new MemPlugin();

      await p.mkdir(abcDir, { recursive: true });
      await p.writeFile(path.join(abcDir, 'foo.txt'), 'xxx');

      await assertAsyncError(p.rmdir(abDir), 'ENOTEMPTY');
      await assertAsyncError(p.rmdir(abcDir), 'ENOTEMPTY');
    });

    it('fails on file', async () => {
      const p = new MemPlugin();

      await p.writeFile(fooTxt, 'xxx');
      await assertAsyncError(p.rmdir(fooTxt), 'ENOTDIR');
    });
  });

  describe('stat()', () => {
    it('stats root dir', async () => {
      const p = new MemPlugin();

      const stat = await p.stat(GIT_CLONE_DIR);

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

      await p.writeFile(fooTxt, 'xxx');
      const stat = await p.stat(fooTxt);

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
      await assertAsyncError(p.stat(barTxt), 'ENOENT');
    });
  });
});
