import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import path from 'path';

import { GIT_CLONE_DIR } from '../git-vcs';
import { MemClient } from '../mem-client';
import { assertAsyncError, setupDateMocks } from './util';

describe('MemClient', () => {
  afterAll(() => jest.restoreAllMocks());
  beforeEach(setupDateMocks);
  const fooTxt = 'foo.txt';
  const barTxt = 'bar.txt';
  describe('readfile()', () => {
    it('fails to read', async () => {
      const fsClient = new MemClient();
      await assertAsyncError(fsClient.readFile(fooTxt), 'ENOENT');
    });

    it('reads a file', async () => {
      const fsClient = new MemClient();
      await fsClient.writeFile(fooTxt, 'Hello World!');
      expect((await fsClient.readFile(fooTxt)).toString()).toBe('Hello World!');
    });
  });

  describe('writeFile()', () => {
    it('fails to write over directory', async () => {
      const fsClient = new MemClient();
      const dirName = 'foo';
      await fsClient.mkdir(dirName);
      await assertAsyncError(fsClient.writeFile(dirName, 'Hello World 2!'), 'EISDIR');
    });

    it('overwrites file', async () => {
      const fsClient = new MemClient();
      await fsClient.writeFile(fooTxt, 'Hello World!');
      await fsClient.writeFile(fooTxt, 'Hello World 2!');
      expect((await fsClient.readFile(fooTxt)).toString()).toBe('Hello World 2!');
    });

    it('flag "a" file', async () => {
      const fsClient = new MemClient();
      await fsClient.writeFile(fooTxt, 'Hello World!', {
        flag: 'a',
      });
      await fsClient.writeFile(fooTxt, 'xxx', {
        flag: 'a',
      });
      expect((await fsClient.readFile(fooTxt)).toString()).toBe('Hello World!xxx');
    });

    it('flags "ax" and "wx" fail if path exists', async () => {
      const fsClient = new MemClient();
      await fsClient.writeFile(fooTxt, 'Hello World!');
      await assertAsyncError(
        fsClient.writeFile(fooTxt, 'aaa', {
          flag: 'ax',
        }),
        'EEXIST',
      );
      await assertAsyncError(
        fsClient.writeFile(fooTxt, 'aaa', {
          flag: 'wx',
        }),
        'EEXIST',
      );
    });

    it('fails if flag "r"', async () => {
      const fsClient = new MemClient();
      await assertAsyncError(
        fsClient.writeFile(fooTxt, 'aaa', {
          flag: 'r',
        }),
        'EBADF',
      );
    });

    it('fails if dir missing', async () => {
      const fsClient = new MemClient();
      await assertAsyncError(
        fsClient.writeFile(fooTxt, 'aaa', {
          flag: 'r',
        }),
        'EBADF',
      );
    });

    it('works with flags', async () => {
      const fsClient = new MemClient();
      await fsClient.writeFile(fooTxt, 'Hello World!', {
        flag: 'a',
      });
      await fsClient.writeFile(fooTxt, 'xxx', {
        flag: 'a',
      });
      expect((await fsClient.readFile(fooTxt)).toString()).toBe('Hello World!xxx');
    });
  });

  describe('unlink()', () => {
    it('unlinks file', async () => {
      const fsClient = new MemClient();
      await fsClient.writeFile(fooTxt, 'xxx');
      await fsClient.unlink(fooTxt);
      await assertAsyncError(fsClient.readFile(fooTxt), 'ENOENT');
    });

    it('fails to unlinks missing file', async () => {
      const fsClient = new MemClient();
      await assertAsyncError(fsClient.unlink(path.join('not', 'exist.txt')), 'ENOENT');
    });
  });

  describe('readdir()', () => {
    it('lists dir', async () => {
      const fsClient = new MemClient();
      // Root dir should always exist
      expect(await fsClient.readdir(GIT_CLONE_DIR)).toEqual([]);
      // Write a file and list it again
      await fsClient.writeFile(fooTxt, 'Hello World!');
      await fsClient.writeFile(barTxt, 'Bar!');
      expect(await fsClient.readdir(GIT_CLONE_DIR)).toEqual(['bar.txt', 'foo.txt']);
    });

    it('errors on file', async () => {
      const fsClient = new MemClient();
      await fsClient.writeFile(fooTxt, 'Bar!');
      await assertAsyncError(fsClient.readdir(fooTxt), 'ENOTDIR');
    });

    it('errors on missing directory', async () => {
      const fsClient = new MemClient();
      await assertAsyncError(fsClient.readdir(path.join('/', 'invalid')), 'ENOENT');
    });
  });

  describe('mkdir()', () => {
    const fooDir = 'foo';
    const fooBarDir = path.join(fooDir, 'bar');
    const cloneFooDir = path.join(GIT_CLONE_DIR, 'foo');
    const cloneFooBarDir = path.join(GIT_CLONE_DIR, 'foo', 'bar');
    const cloneFooBarBazDir = path.join(GIT_CLONE_DIR, 'foo', 'bar', 'baz');

    it('creates directory', async () => {
      const fsClient = new MemClient();
      await fsClient.mkdir(fooDir);
      await fsClient.mkdir(fooBarDir);
      expect(await fsClient.readdir(GIT_CLONE_DIR)).toEqual(['foo']);
      expect(await fsClient.readdir(cloneFooDir)).toEqual(['bar']);
    });

    it('creates directory non-recursively', async () => {
      const fsClient = new MemClient();
      await fsClient.mkdir(cloneFooDir, {
        recursive: true,
      });
      await fsClient.mkdir(cloneFooBarDir);
      expect(await fsClient.readdir(cloneFooBarDir)).toEqual([]);
    });

    it('creates directory recursively', async () => {
      const fsClient = new MemClient();
      await fsClient.mkdir(cloneFooBarBazDir, {
        recursive: true,
      });
      expect(await fsClient.readdir(cloneFooBarBazDir)).toEqual([]);
    });

    it('fails to create if no parent', async () => {
      const fsClient = new MemClient();
      await assertAsyncError(fsClient.mkdir(cloneFooBarBazDir), 'ENOENT');
    });
  });

  describe('rmdir()', () => {
    const abDir = path.join('a', 'b');
    const abcDir = path.join('a', 'b', 'c');

    it('removes a dir', async () => {
      const fsClient = new MemClient();
      await fsClient.mkdir(abcDir, {
        recursive: true,
      });
      expect(await fsClient.readdir(abDir)).toEqual(['c']);
      await fsClient.rmdir(abcDir);
      expect(await fsClient.readdir(abDir)).toEqual([]);
    });

    it('fails on non-empty dir', async () => {
      const fsClient = new MemClient();
      await fsClient.mkdir(abcDir, {
        recursive: true,
      });
      await fsClient.writeFile(path.join(abcDir, 'foo.txt'), 'xxx');
      await assertAsyncError(fsClient.rmdir(abDir), 'ENOTEMPTY');
      await assertAsyncError(fsClient.rmdir(abcDir), 'ENOTEMPTY');
    });

    it('fails on file', async () => {
      const fsClient = new MemClient();
      await fsClient.writeFile(fooTxt, 'xxx');
      await assertAsyncError(fsClient.rmdir(fooTxt), 'ENOTDIR');
    });
  });

  describe('stat()', () => {
    it('stats root dir', async () => {
      const fsClient = new MemClient();
      const stat = await fsClient.stat(GIT_CLONE_DIR);
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
      const fsClient = new MemClient();
      await fsClient.writeFile(fooTxt, 'xxx');
      const stat = await fsClient.stat(fooTxt);
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
      const fsClient = new MemClient();
      await assertAsyncError(fsClient.stat(barTxt), 'ENOENT');
    });
  });
});
