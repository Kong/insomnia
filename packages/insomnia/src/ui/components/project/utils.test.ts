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

  it('falls back to the derived repo name when no override is given', () => {
    expect(resolveCloneFolderName(undefined, 'https://github.com/org/repo-name.git')).toBe('repo-name');
  });

  it('falls back to "repository" when there is neither an override nor a usable URL', () => {
    expect(resolveCloneFolderName()).toBe('repository');
  });
});
