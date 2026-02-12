import { describe, expect, it } from 'vitest';

import { normalizeFolderPath } from '../../../common/misc';

const isWindows = process.platform === 'win32';

describe('normalizeFolderPath', () => {
  describe.skipIf(isWindows)('POSIX paths', () => {
    it.each([
      { input: '/Users/foo/bar', expected: '/Users/foo/bar' },
      { input: '/Users/foo/bar/', expected: '/Users/foo/bar' },
      { input: '/Users/foo/bar///', expected: '/Users/foo/bar' },
      { input: '/Users//foo//bar', expected: '/Users/foo/bar' },
      { input: '/Volumes/External/data/', expected: '/Volumes/External/data' },
      { input: '/Applications/Insomnia.app/Contents/', expected: '/Applications/Insomnia.app/Contents' },
    ])('normalizes "$input" to "$expected"', ({ input, expected }) => {
      expect(normalizeFolderPath(input)).toBe(expected);
    });
  });

  describe.runIf(isWindows)('Windows paths', () => {
    it.each([
      { input: 'C:\\Users\\foo\\bar', expected: 'C:\\Users\\foo\\bar' },
      { input: 'C:\\Users\\foo\\bar\\', expected: 'C:\\Users\\foo\\bar' },
      { input: 'C:\\Users\\foo\\bar\\\\\\', expected: 'C:\\Users\\foo\\bar' },
      { input: 'C:\\Users\\\\foo\\\\bar', expected: 'C:\\Users\\foo\\bar' },
    ])('normalizes "$input" to "$expected"', ({ input, expected }) => {
      expect(normalizeFolderPath(input)).toBe(expected);
    });
  });
});
