import { describe, expect, it } from 'vitest';

import { deriveRepoName, resolveCloneFolderName } from './utils';

describe('deriveRepoName', () => {
  it('derives the repo name from a .git URL', () => {
    expect(deriveRepoName('https://github.com/organization/repo-name.git')).toBe('repo-name');
  });

  it('derives the repo name from a URL without a .git suffix', () => {
    expect(deriveRepoName('https://github.com/organization/repo-name')).toBe('repo-name');
  });

  it('strips a trailing slash before deriving the name', () => {
    expect(deriveRepoName('https://github.com/organization/repo-name.git/')).toBe('repo-name');
  });

  it('strips query strings and fragments', () => {
    expect(deriveRepoName('https://github.com/organization/repo-name?foo=bar#section')).toBe('repo-name');
  });

  it('handles an SSH-style URL', () => {
    expect(deriveRepoName('git@github.com:organization/repo-name.git')).toBe('repo-name');
  });

  it('falls back to "repository" for an empty/undefined URL', () => {
    expect(deriveRepoName('')).toBe('repository');
    expect(deriveRepoName()).toBe('repository');
  });

  it('falls back to "repository" for a URL with no usable name segment', () => {
    expect(deriveRepoName('https://github.com/organization/.git')).toBe('repository');
    expect(deriveRepoName('https://github.com/organization/.')).toBe('repository');
  });
});

describe('resolveCloneFolderName', () => {
  it('uses the explicit override when set', () => {
    expect(resolveCloneFolderName('my-custom-folder', 'https://github.com/org/repo-name.git')).toBe(
      'my-custom-folder',
    );
  });

  it('trims whitespace around the override', () => {
    expect(resolveCloneFolderName('  my-custom-folder  ', 'https://github.com/org/repo-name.git')).toBe(
      'my-custom-folder',
    );
  });

  // Regression: a whitespace-only override must not produce a blank/invalid
  // folder name — fall back to the derived repo name instead.
  it('falls back to the derived repo name when the override is whitespace-only', () => {
    expect(resolveCloneFolderName('   ', 'https://github.com/org/repo-name.git')).toBe('repo-name');
  });

  // Regression: a bare "." or ".." would join into the current/parent
  // directory of the chosen clone location instead of a new folder inside
  // it — must fall back to the derived repo name instead, same as
  // deriveRepoName's own guard.
  it('falls back to the derived repo name when the override is "." or ".."', () => {
    expect(resolveCloneFolderName('.', 'https://github.com/org/repo-name.git')).toBe('repo-name');
    expect(resolveCloneFolderName('..', 'https://github.com/org/repo-name.git')).toBe('repo-name');
  });

  // Regression: an override containing a path separator would let the clone
  // land somewhere other than a single new folder directly inside the chosen
  // parent — must fall back to the derived repo name instead.
  it('falls back to the derived repo name when the override contains a path separator', () => {
    expect(resolveCloneFolderName('foo/bar', 'https://github.com/org/repo-name.git')).toBe('repo-name');
    expect(resolveCloneFolderName('foo\\bar', 'https://github.com/org/repo-name.git')).toBe('repo-name');
  });

  it('falls back to the derived repo name when no override is given', () => {
    expect(resolveCloneFolderName(undefined, 'https://github.com/org/repo-name.git')).toBe('repo-name');
  });

  it('falls back to "repository" when there is neither an override nor a usable URL', () => {
    expect(resolveCloneFolderName()).toBe('repository');
  });
});
