import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ElectronStorage from '../../main/electron-storage';

describe('ElectronStorage.setItemDurable() / getItemStrict()', () => {
  let dir: string;
  let storage: ElectronStorage;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-electronstorage-durable-'));
    storage = new ElectronStorage(dir);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const files = () => fs.readdirSync(dir);

  describe('setItemDurable()', () => {
    it('stores the value as JSON that getItem and getItemStrict read back', async () => {
      await storage.setItemDurable('key', { version: 1, ciphertext: 'abc' });
      expect(fs.readFileSync(path.join(dir, 'key'), 'utf8')).toBe('{"version":1,"ciphertext":"abc"}');
      expect(storage.getItemStrict('key')).toEqual({ version: 1, ciphertext: 'abc' });
      expect(storage.getItem('key')).toEqual({ version: 1, ciphertext: 'abc' });
    });

    it('replaces the previous content and leaves no temporary file behind', async () => {
      await storage.setItemDurable('key', 'first');
      await storage.setItemDurable('key', 'second');
      expect(storage.getItemStrict('key')).toBe('second');
      expect(files()).toEqual(['key']);
    });

    it('writes a temporary file, fsyncs it and only then renames it over the target', async () => {
      const probe = await fs.promises.open(path.join(dir, 'probe'), 'w');
      const sync = vi.spyOn(Object.getPrototypeOf(probe), 'sync');
      await probe.close();
      fs.rmSync(path.join(dir, 'probe'));
      const rename = vi.spyOn(fs.promises, 'rename');

      await storage.setItemDurable('key', 'value');

      expect(rename).toHaveBeenCalledTimes(1);
      const [from, to] = rename.mock.calls[0] as [string, string];
      expect(from).not.toBe(to);
      expect(path.dirname(from)).toBe(path.dirname(to));
      expect(sync).toHaveBeenCalled();
      expect(sync.mock.invocationCallOrder[0]).toBeLessThan(rename.mock.invocationCallOrder[0]);
      // The directory is fsynced after the rename, except on Windows where a directory cannot be opened for it
      if (process.platform === 'win32') {
        expect(sync).toHaveBeenCalledTimes(1);
      } else {
        expect(sync).toHaveBeenCalledTimes(2);
        expect(sync.mock.invocationCallOrder[1]).toBeGreaterThan(rename.mock.invocationCallOrder[0]);
      }
    });

    it('rejects when the write fails, leaves the existing value and no temporary file', async () => {
      await storage.setItemDurable('key', 'old');
      vi.spyOn(fs.promises, 'rename').mockRejectedValueOnce(new Error('rename failed'));
      await expect(storage.setItemDurable('key', 'new')).rejects.toThrow('rename failed');
      expect(storage.getItemStrict('key')).toBe('old');
      expect(files()).toEqual(['key']);
    });

    it('rejects when the target cannot be replaced, which setItem would only log', async () => {
      fs.mkdirSync(path.join(dir, 'key'));
      await expect(storage.setItemDurable('key', 'value')).rejects.toThrow();
      expect(files()).toEqual(['key']);
      expect(fs.statSync(path.join(dir, 'key')).isDirectory()).toBe(true);
    });

    it('rejects when the directory is gone, leaving nothing behind', async () => {
      fs.rmSync(dir, { recursive: true });
      await expect(storage.setItemDurable('key', 'value')).rejects.toThrow();
    });

    it('wins over a buffered setItem of the same key', async () => {
      storage.setItem('key', 'buffered');
      await storage.setItemDurable('key', 'durable');
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(storage.getItemStrict('key')).toBe('durable');
    });

    it('rejects invalid keys', async () => {
      for (const key of ['', '.', '..', 'a/b', 'a\\b', 'a\0b']) {
        await expect(storage.setItemDurable(key, 'value')).rejects.toThrow('Invalid electron storage key');
      }
    });
  });

  describe('rename retries (a virus scanner on Windows briefly holds the target)', () => {
    const originalPlatform = process.platform;
    const setPlatform = (platform: string) => Object.defineProperty(process, 'platform', { value: platform });
    afterEach(() => {
      setPlatform(originalPlatform);
    });
    const transientError = (code: string) => Object.assign(new Error(`${code}: rename failed`), { code });

    it.each(['EPERM', 'EBUSY', 'EACCES'])('retries %s on Windows and then succeeds', async code => {
      setPlatform('win32');
      const rename = vi.spyOn(fs.promises, 'rename');
      rename.mockRejectedValueOnce(transientError(code)).mockRejectedValueOnce(transientError(code));

      await storage.setItemDurable('key', 'value');

      expect(rename).toHaveBeenCalledTimes(3);
      expect(storage.getItemStrict('key')).toBe('value');
      expect(files()).toEqual(['key']);
    });

    it('gives up after a few attempts, and leaves no temporary file', async () => {
      setPlatform('win32');
      const rename = vi.spyOn(fs.promises, 'rename').mockRejectedValue(transientError('EBUSY'));

      await expect(storage.setItemDurable('key', 'value')).rejects.toThrow('EBUSY');

      expect(rename).toHaveBeenCalledTimes(5);
      expect(files()).toEqual([]);
    });

    it('does not retry other errors', async () => {
      setPlatform('win32');
      const rename = vi.spyOn(fs.promises, 'rename').mockRejectedValue(transientError('ENOENT'));
      await expect(storage.setItemDurable('key', 'value')).rejects.toThrow('ENOENT');
      expect(rename).toHaveBeenCalledTimes(1);
    });

    it('does not retry on other platforms, where these errors are not transient', async () => {
      setPlatform('linux');
      const rename = vi.spyOn(fs.promises, 'rename').mockRejectedValue(transientError('EPERM'));
      await expect(storage.setItemDurable('key', 'value')).rejects.toThrow('EPERM');
      expect(rename).toHaveBeenCalledTimes(1);
    });
  });

  describe('isSameFile()', () => {
    it('is true for two names of the same file, and false for different files', () => {
      fs.writeFileSync(path.join(dir, 'a'), '1');
      fs.writeFileSync(path.join(dir, 'b'), '2');
      fs.linkSync(path.join(dir, 'a'), path.join(dir, 'a-link'));
      expect(storage.isSameFile('a', 'a-link')).toBe(true);
      expect(storage.isSameFile('a', 'a')).toBe(true);
      expect(storage.isSameFile('a', 'b')).toBe(false);
    });

    it('is false when either file does not exist', () => {
      fs.writeFileSync(path.join(dir, 'a'), '1');
      expect(storage.isSameFile('a', 'missing')).toBe(false);
      expect(storage.isSameFile('missing', 'a')).toBe(false);
      expect(storage.isSameFile('missing', 'missing-too')).toBe(false);
    });

    it('is false when the file system does not tell files apart (inode 0 for everything)', () => {
      fs.writeFileSync(path.join(dir, 'a'), '1');
      fs.writeFileSync(path.join(dir, 'b'), '2');
      vi.spyOn(fs, 'statSync').mockReturnValue({ dev: 1n, ino: 0n } as never);
      expect(storage.isSameFile('a', 'b')).toBe(false);
    });

    it('throws, rather than answering "no", when a file cannot be inspected', () => {
      fs.writeFileSync(path.join(dir, 'a'), '1');
      fs.writeFileSync(path.join(dir, 'b'), '2');
      vi.spyOn(fs, 'statSync').mockImplementation(() => {
        throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      });
      expect(() => storage.isSameFile('a', 'b')).toThrow('EACCES');
    });
  });

  describe('getItemStrict()', () => {
    it('returns null only when the file does not exist, and does not create it', () => {
      expect(storage.getItemStrict('missing')).toBeNull();
      expect(files()).toEqual([]);
    });

    it('throws, and leaves the file alone, when the file cannot be parsed', () => {
      fs.writeFileSync(path.join(dir, 'key'), '{bad JSON');
      expect(() => storage.getItemStrict('key')).toThrow();
      expect(fs.readFileSync(path.join(dir, 'key'), 'utf8')).toBe('{bad JSON');
    });

    it('throws when the file exists but cannot be read', () => {
      fs.mkdirSync(path.join(dir, 'key'));
      expect(() => storage.getItemStrict('key')).toThrow();
    });

    it('does not let a stored null pass for a missing file', () => {
      fs.writeFileSync(path.join(dir, 'key'), 'null');
      expect(() => storage.getItemStrict('key')).toThrow('holds null');
    });

    it('rejects invalid keys', () => {
      for (const key of ['', '.', '..', 'a/b', 'a\\b', 'a\0b']) {
        expect(() => storage.getItemStrict(key)).toThrow('Invalid electron storage key');
      }
    });

    it('is the difference to getItem, which treats an unreadable file as the default and a missing one as an item to create', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      fs.writeFileSync(path.join(dir, 'corrupt'), '{bad JSON');
      expect(storage.getItem('corrupt', 'default')).toBe('default');
      expect(() => storage.getItemStrict('corrupt')).toThrow();
      storage.getItem('missing', 'default');
      storage._flush();
      expect(files()).toContain('missing');
      expect(storage.getItemStrict('another')).toBeNull();
      expect(files()).not.toContain('another');
    });
  });
});
