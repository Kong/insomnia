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

  it('rejects a path that escapes the dir', () => {
    expect(isPathInsideDir('../', dir)).toBe(false);
    expect(isPathInsideDir('../../etc', dir)).toBe(false);
  });

  it('rejects an absolute path outside the dir', () => {
    expect(isPathInsideDir('/etc/passwd', dir)).toBe(false);
  });

  it('rejects a sibling directory with a matching prefix', () => {
    expect(isPathInsideDir(path.join('..', 'insomnia-user-data-evil'), dir)).toBe(false);
  });
});
