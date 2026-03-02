import { describe, expect, it } from 'vitest';

import { normalizeFolderPath, validateFolderInput } from '../../../common/misc';

const isWindows = process.platform === 'win32';

describe('normalizeFolderPath', () => {
  describe.skipIf(isWindows)('POSIX paths', () => {
    it.each([
      // root is preserved as-is
      { input: '/', expected: '/' },
      { input: '///', expected: '/' },
      // trailing slash removal
      { input: '/Users/foo/bar', expected: '/Users/foo/bar' },
      { input: '/Users/foo/bar/', expected: '/Users/foo/bar' },
      { input: '/Users/foo/bar///', expected: '/Users/foo/bar' },
      // duplicate separator collapse
      { input: '/Users//foo//bar', expected: '/Users/foo/bar' },
      // real-world paths
      { input: '/Volumes/External/data/', expected: '/Volumes/External/data' },
      { input: '/Applications/Insomnia.app/Contents/', expected: '/Applications/Insomnia.app/Contents' },
      { input: '/Users/名前/docs', expected: '/Users/名前/docs' },
      { input: '/Users/my folder/docs', expected: '/Users/my folder/docs' },
      // ".." and "./" resolution (format error fires in the UI before storing)
      { input: '/Users/foo/../bar', expected: '/Users/bar' },
      { input: './relative/path', expected: 'relative/path' },
    ])('normalizes "$input" to "$expected"', ({ input, expected }) => {
      expect(normalizeFolderPath(input)).toBe(expected);
    });
  });

  describe.runIf(isWindows)('Windows paths', () => {
    it.each([
      // root is preserved as-is
      { input: 'C:\\', expected: 'C:\\' },
      { input: 'C:\\\\', expected: 'C:\\' },
      // trailing backslash removal
      { input: 'C:\\Users\\foo\\bar', expected: 'C:\\Users\\foo\\bar' },
      { input: 'C:\\Users\\foo\\bar\\', expected: 'C:\\Users\\foo\\bar' },
      { input: 'C:\\Users\\foo\\bar\\\\\\', expected: 'C:\\Users\\foo\\bar' },
      { input: 'C:\\Users\\\\foo\\\\bar', expected: 'C:\\Users\\foo\\bar' },
    ])('normalizes "$input" to "$expected"', ({ input, expected }) => {
      expect(normalizeFolderPath(input)).toBe(expected);
    });
  });

  it('does not throw on a path longer than 4096 characters', () => {
    expect(() => normalizeFolderPath('/' + 'a'.repeat(4096))).not.toThrow();
  });

  it('is case sensitive', () => {
    expect(normalizeFolderPath('/Users/foo')).not.toBe(normalizeFolderPath('/Users/FOO'));
  });
});

describe('validateFolderInput', () => {
  describe('empty input', () => {
    it('returns error for empty string', () => {
      expect(validateFolderInput('', [])).toEqual({ ok: false, error: 'Enter a folder path to add.' });
    });

    it('returns error for whitespace-only input (trimmed to empty)', () => {
      expect(validateFolderInput('   ', [])).toEqual({ ok: false, error: 'Enter a folder path to add.' });
    });
  });

  describe.skipIf(isWindows)('format validation (POSIX)', () => {
    it('suggests normalized form when input has a trailing slash', () => {
      expect(validateFolderInput('/Users/foo/', [])).toEqual({
        ok: false,
        error: 'Invalid folder path format. Did you mean "/Users/foo"?',
      });
    });

    it('suggests normalized form when input has ".." segments', () => {
      expect(validateFolderInput('/Users/foo/../bar', [])).toEqual({
        ok: false,
        error: 'Invalid folder path format. Did you mean "/Users/bar"?',
      });
    });

    it('suggests normalized form when input has a "./" prefix', () => {
      expect(validateFolderInput('./relative/path', [])).toEqual({
        ok: false,
        error: 'Invalid folder path format. Did you mean "relative/path"?',
      });
    });

    it('format error takes priority over duplicate error', () => {
      // "/Users/foo/" !== "/Users/foo", so format check fires before duplicate check
      expect(validateFolderInput('/Users/foo/', ['/Users/foo'])).toEqual({
        ok: false,
        error: 'Invalid folder path format. Did you mean "/Users/foo"?',
      });
    });
  });

  describe.runIf(isWindows)('format validation (Windows)', () => {
    it('suggests normalized form when input has a trailing backslash', () => {
      expect(validateFolderInput('C:\\Users\\foo\\', [])).toEqual({
        ok: false,
        error: 'Invalid folder path format. Did you mean "C:\\Users\\foo"?',
      });
    });

    it('suggests normalized form when input has ".." segments', () => {
      expect(validateFolderInput('C:\\Users\\foo\\..\\bar', [])).toEqual({
        ok: false,
        error: 'Invalid folder path format. Did you mean "C:\\Users\\bar"?',
      });
    });

    it('format error takes priority over duplicate error', () => {
      expect(validateFolderInput('C:\\Users\\foo\\', ['C:\\Users\\foo'])).toEqual({
        ok: false,
        error: 'Invalid folder path format. Did you mean "C:\\Users\\foo"?',
      });
    });
  });

  describe.skipIf(isWindows)('duplicate detection (POSIX)', () => {
    it('returns duplicate error when the exact path is already in the list', () => {
      expect(validateFolderInput('/Users/foo', ['/Users/foo'])).toEqual({
        ok: false,
        error: 'Duplicate folders are not allowed.',
      });
    });

    it('returns no error when the path is not in the list', () => {
      expect(validateFolderInput('/Users/bar', ['/Users/foo'])).toEqual({
        ok: true,
        normalizedValue: '/Users/bar',
      });
    });

    it('returns no error when the list is empty', () => {
      expect(validateFolderInput('/Users/foo', [])).toEqual({
        ok: true,
        normalizedValue: '/Users/foo',
      });
    });
  });

  describe.runIf(isWindows)('duplicate detection (Windows)', () => {
    it('returns duplicate error when the exact path is already in the list', () => {
      expect(validateFolderInput('C:\\Users\\foo', ['C:\\Users\\foo'])).toEqual({
        ok: false,
        error: 'Duplicate folders are not allowed.',
      });
    });

    it('returns no error when the path is not in the list', () => {
      expect(validateFolderInput('C:\\Users\\bar', ['C:\\Users\\foo'])).toEqual({
        ok: true,
        normalizedValue: 'C:\\Users\\bar',
      });
    });

    it('returns no error when the list is empty', () => {
      expect(validateFolderInput('C:\\Users\\foo', [])).toEqual({
        ok: true,
        normalizedValue: 'C:\\Users\\foo',
      });
    });
  });

  it.skipIf(isWindows)('trims leading and trailing whitespace before processing', () => {
    expect(validateFolderInput('  /Users/docs  ', [])).toEqual({
      ok: true,
      normalizedValue: '/Users/docs',
    });
  });
});
