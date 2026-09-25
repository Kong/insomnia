import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { assertPathWithinDir, writeFileWithinDir } from '../safe-fs-write';

describe('safe-fs-write', () => {
  let baseDir: string;
  let outsideDir: string;

  beforeEach(async () => {
    baseDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-safe-fs-write-base-'));
    outsideDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-safe-fs-write-outside-'));
  });

  afterEach(async () => {
    await fs.promises.rm(baseDir, { recursive: true, force: true });
    await fs.promises.rm(outsideDir, { recursive: true, force: true });
  });

  it('allows a path that resolves inside baseDir', async () => {
    await expect(assertPathWithinDir(baseDir, path.join(baseDir, 'ok.txt'))).resolves.not.toThrow();
  });

  it('rejects a lexical traversal out of baseDir', async () => {
    await expect(assertPathWithinDir(baseDir, path.join(baseDir, '..', 'escape.txt'))).rejects.toThrow();
  });

  // Regression: a symlink target check on only the final path component
  // (e.g. O_NOFOLLOW on open()) is not enough — a symlinked *intermediate
  // directory* can still redirect the write outside baseDir even though the
  // final path string and the leaf itself look fine.
  it('rejects a path through a symlinked intermediate directory that escapes baseDir', async () => {
    const linkedDir = path.join(baseDir, 'linked-dir');
    await fs.promises.symlink(outsideDir, linkedDir);
    const target = path.join(linkedDir, 'escaped.yaml');

    await expect(assertPathWithinDir(baseDir, target)).rejects.toThrow();
    await expect(writeFileWithinDir(baseDir, target, 'new-content')).rejects.toThrow();
    await expect(fs.promises.access(path.join(outsideDir, 'escaped.yaml'))).rejects.toThrow();
  });

  it('writes content and refuses to follow a symlinked leaf file', async () => {
    const okPath = path.join(baseDir, 'ok.txt');
    await writeFileWithinDir(baseDir, okPath, 'hello');
    expect(await fs.promises.readFile(okPath, 'utf8')).toBe('hello');

    const target = path.join(outsideDir, 'outside.txt');
    await fs.promises.writeFile(target, 'original', 'utf8');
    const linkPath = path.join(baseDir, 'link.txt');
    await fs.promises.symlink(target, linkPath);

    await expect(writeFileWithinDir(baseDir, linkPath, 'new-content')).rejects.toThrow();
    expect(await fs.promises.readFile(target, 'utf8')).toBe('original');
  });
});
