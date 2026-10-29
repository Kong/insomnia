import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import FileSystemDriver from '../file-system-driver';

// Ancestor symlinks were already guarded; a symlink planted as the final path component or as an
// entry inside a listed directory must not expose files outside the store either.

describe.skipIf(process.platform === 'win32')('FileSystemDriver leaf symlinks', () => {
  let root: string;
  let storeDir: string;
  let outsideDir: string;
  let driver: FileSystemDriver;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-driver-leaf-symlink-'));
    const dataDir = path.join(root, 'data');
    storeDir = path.join(dataDir, 'version-control');
    outsideDir = path.join(root, 'outside');
    await fs.mkdir(outsideDir);
    await fs.writeFile(path.join(outsideDir, 'secret.json'), 'SECRET');
    driver = FileSystemDriver.create(dataDir);
    await driver.setItem('/projects/p/branches/real.json', Buffer.from('ok'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('getItem and hasItem refuse a leaf symlink to a file outside the store', async () => {
    await fs.symlink(path.join(outsideDir, 'secret.json'), path.join(storeDir, 'projects/p/branches/evil.json'));
    await expect(driver.getItem('/projects/p/branches/evil.json')).rejects.toThrow('escapes the store');
    await expect(driver.hasItem('/projects/p/branches/evil.json')).rejects.toThrow('escapes the store');
  });

  it('keys() does not enumerate through symlinked directories or list symlinks', async () => {
    await fs.symlink(outsideDir, path.join(storeDir, 'projects/p/branches/evildir'));
    await fs.symlink(path.join(outsideDir, 'secret.json'), path.join(storeDir, 'projects/p/branches/evil.json'));
    const keys = await driver.keys('/projects/p/branches', true);
    expect(keys).toEqual(['/projects/p/branches/real.json']);
  });

  it('removeItem unlinks a planted symlink without touching its target', async () => {
    await fs.symlink(path.join(outsideDir, 'secret.json'), path.join(storeDir, 'projects/p/branches/evil.json'));
    await driver.removeItem('/projects/p/branches/evil.json');
    expect(await fs.readFile(path.join(outsideDir, 'secret.json'), 'utf8')).toBe('SECRET');
  });

  it('setItem over a planted symlink replaces the link and never writes to the target', async () => {
    await fs.symlink(path.join(outsideDir, 'secret.json'), path.join(storeDir, 'projects/p/branches/evil.json'));
    await driver.setItem('/projects/p/branches/evil.json', Buffer.from('new')).catch(() => {});
    expect(await fs.readFile(path.join(outsideDir, 'secret.json'), 'utf8')).toBe('SECRET');
  });

  it('still reads regular files and a dangling leaf as absent', async () => {
    expect((await driver.getItem('/projects/p/branches/real.json'))?.toString()).toBe('ok');
    expect(await driver.getItem('/projects/p/branches/none.json')).toBeNull();
  });
});
