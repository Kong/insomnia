import { describe, expect, it } from 'vitest';

import { isSafeRepoFolderPath } from '../repo-folder-path';

describe('isSafeRepoFolderPath', () => {
  it.each(['', undefined, null, 'specs', 'specs/v1', 'specs\\v1', '.github/workflows'])('accepts %j', folderPath => {
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
    '..',
    'a/../..',
    '/etc',
    '\\abs',
    'C:\\Windows',
  ])('rejects %j', folderPath => {
    expect(isSafeRepoFolderPath(folderPath)).toBe(false);
  });
});
