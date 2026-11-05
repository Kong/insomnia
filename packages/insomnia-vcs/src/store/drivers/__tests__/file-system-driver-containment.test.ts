import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import FileSystemDriver from '../file-system-driver';

const maliciousKeys: Record<string, string> = {
  'parent traversal': '/projects/p/blobs/zz/../../../../../ESCAPED_PROOF.txt',
  'leading parent traversal': '../ESCAPED_PROOF.txt',
  'bare parent': '..',
  'NUL byte': '/projects/p\0/../../../ESCAPED_PROOF.txt',
};

describe('FileSystemDriver path containment', () => {
  let root: string;
  let storeDir: string;
  let driver: FileSystemDriver;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-driver-containment-'));
    const dataDir = path.join(root, 'data');
    storeDir = path.join(dataDir, 'version-control');
    driver = FileSystemDriver.create(dataDir);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  async function filesOutsideStore() {
    const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
    return entries
      .filter(e => e.isFile())
      .map(e => path.join(e.parentPath, e.name))
      .filter(p => !p.startsWith(storeDir + path.sep));
  }

  it('round-trips a normal key', async () => {
    await driver.setItem('/projects/p/meta.json', Buffer.from('ok'));
    expect(await driver.hasItem('/projects/p/meta.json')).toBe(true);
    expect((await driver.getItem('/projects/p/meta.json'))?.toString()).toBe('ok');
    expect(await driver.keys('/projects/', true)).toEqual(['/projects/p/meta.json']);
    await driver.removeItem('/projects/p/meta.json');
    expect(await driver.hasItem('/projects/p/meta.json')).toBe(false);
  });

  describe.each(Object.entries(maliciousKeys))('%s', (_label, key) => {
    it('setItem rejects and writes nothing outside the store', async () => {
      await expect(driver.setItem(key, Buffer.from('X'))).rejects.toThrow();
      expect(await filesOutsideStore()).toEqual([]);
    });

    it('getItem/hasItem/removeItem/keys reject', async () => {
      await expect(driver.getItem(key)).rejects.toThrow();
      await expect(driver.hasItem(key)).rejects.toThrow();
      await expect(driver.removeItem(key)).rejects.toThrow();
      await expect(driver.keys(key, true)).rejects.toThrow();
    });
  });

  it('does not create directories outside the store for a rejected key', async () => {
    await expect(driver.setItem('/../../escaped-dir/x/y.txt', Buffer.from('X'))).rejects.toThrow();
    await expect(fs.stat(path.join(root, 'escaped-dir'))).rejects.toThrow();
  });

  it('does not write through a symlinked directory that points outside the store', async () => {
    const outside = path.join(root, 'outside');
    await fs.mkdir(outside, { recursive: true });
    await fs.mkdir(path.join(storeDir, 'projects'), { recursive: true });
    await fs.symlink(outside, path.join(storeDir, 'projects', 'link'));

    await expect(driver.setItem('/projects/link/pwned.txt', Buffer.from('X'))).rejects.toThrow();
    expect(await filesOutsideStore()).toEqual([]);
  });
});
