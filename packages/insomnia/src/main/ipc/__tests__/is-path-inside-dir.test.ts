import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isPathInsideDir } from '../path-guard';

describe('isPathInsideDir', () => {
  const dir = path.join('/tmp', 'insomnia-user-data');

  it('accepts a plain nested folder name', () => {
    expect(isPathInsideDir('plugins', dir)).toBe(true);
  });

  it('accepts the dir itself', () => {
    expect(isPathInsideDir('.', dir)).toBe(true);
  });

  it('accepts a legit folder whose name merely starts with two dots', () => {
    expect(isPathInsideDir('..test', dir)).toBe(true);
    expect(isPathInsideDir(path.join('..test', 'nested'), dir)).toBe(true);
    expect(isPathInsideDir(dir, dir)).toBe(true);
  });

  it('rejects a path that escapes the dir', () => {
    expect(isPathInsideDir('..', dir)).toBe(false);
    expect(isPathInsideDir('../', dir)).toBe(false);
    expect(isPathInsideDir(path.join('..test', '..', '..', 'x'), dir)).toBe(false);
    expect(isPathInsideDir('../../etc', dir)).toBe(false);
  });

  it('is lexical only: a path through a symlink inside the dir is still reported as inside', () => {
    // Documented limitation (see path-guard.ts): symlinks are not resolved, so a symlink
    // inside `dir` that points elsewhere passes this check. Symlink-aware checks live in #10560.
    expect(isPathInsideDir(path.join('link-to-elsewhere', 'file'), dir)).toBe(true);
  });

  it('rejects an absolute path outside the dir', () => {
    expect(isPathInsideDir('/etc/passwd', dir)).toBe(false);
  });

  it('rejects a sibling directory with a matching prefix', () => {
    expect(isPathInsideDir(path.join('..', 'insomnia-user-data-evil'), dir)).toBe(false);
  });
});
