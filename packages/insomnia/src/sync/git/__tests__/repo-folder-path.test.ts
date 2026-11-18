import { describe, expect, it, vi } from 'vitest';

import { isSafeRepoFolderPath } from '../repo-folder-path';

const platform = vi.hoisted(() => ({ isWindows: false }));

vi.mock('insomnia-data/common', async importOriginal => ({
  ...(await importOriginal<object>()),
  get isWindows() {
    return platform.isWindows;
  },
}));

describe('isSafeRepoFolderPath', () => {
  it.each(['', undefined, null, 'specs', 'specs/v1', 'specs\\v1', '.github/workflows', 'specs: v1', 'a/b:c', 'v: specs'])('accepts %j', folderPath => {
    expect(isSafeRepoFolderPath(folderPath)).toBe(true);
  });

  it.each([
    '.git',
    '.git/hooks',
    'a/.git',
    'a\\.GIT\\hooks',
    '.git.',
    '.git ',
    '.git. ./hooks',
    '.git::$INDEX_ALLOCATION',
    'a/.git:stream/hooks',
    '..::$INDEX_ALLOCATION',
    '..',
    'a/../..',
    '.. ',
    'a/.. /b',
    '/etc',
    '\\abs',
  ])('rejects %j', folderPath => {
    expect(isSafeRepoFolderPath(folderPath)).toBe(false);
  });

  it('rejects a drive-prefixed path on Windows', () => {
    platform.isWindows = true;
    try {
      expect(isSafeRepoFolderPath('C:\\Windows')).toBe(false);
    } finally {
      platform.isWindows = false;
    }
  });
});
