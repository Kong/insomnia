import { describe, expect, it, vi } from 'vitest';

import { isSafeRepoFolderPath, validateRepoFolderName } from '../repo-folder-path';

describe('validateRepoFolderName', () => {
  it('accepts a regular folder name', () => {
    expect(validateRepoFolderName('specs')).toBeNull();
    expect(validateRepoFolderName('my-api_v1')).toBeNull();
    expect(validateRepoFolderName('.github')).toBeNull();
  });

  it.each(['', '   '])('rejects an empty name %j', name => {
    expect(validateRepoFolderName(name)).toBe('Folder name is required');
  });

  it.each(['a/b', 'a\\b'])('rejects path separators in %j', name => {
    expect(validateRepoFolderName(name)).toBe('Folder name cannot contain path separators');
  });

  it.each(['.', '..'])('rejects %j', name => {
    expect(validateRepoFolderName(name)).toBe('Folder name is not allowed');
  });

  it.each(['.git', '.GIT'])('rejects the reserved %j name', name => {
    expect(validateRepoFolderName(name)).toBe('Folder name ".git" is reserved');
  });

  it.each(['a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b', 'a\u0001b'])('rejects invalid characters in %j', name => {
    expect(validateRepoFolderName(name)).toMatch(/cannot contain any of the following characters/);
  });

  it.each(['con', 'NUL', 'com1', 'LPT9', 'aux.txt'])('rejects the Windows reserved name %j', name => {
    expect(validateRepoFolderName(name)).toBe(`"${name}" is a reserved name on Windows`);
  });

  it.each(['console', 'com10', 'nullable'])('accepts %j which only resembles a reserved name', name => {
    expect(validateRepoFolderName(name)).toBeNull();
  });

  it.each([' specs', 'specs ', 'specs.'])('rejects leading/trailing whitespace or trailing period in %j', name => {
    expect(validateRepoFolderName(name)).toMatch(/cannot start or end with a space/);
  });

  it('rejects names that collide with a sibling, case-insensitively', () => {
    expect(validateRepoFolderName('Specs', ['specs', 'README.md'])).toBe(
      'A file or folder with the same name already exists',
    );
    expect(validateRepoFolderName('readme.md', ['specs', 'README.md'])).toBe(
      'A file or folder with the same name already exists',
    );
    expect(validateRepoFolderName('other', ['specs', 'README.md'])).toBeNull();
  });
});

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
