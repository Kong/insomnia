import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import path, { PlatformPath } from 'path';

import { convertToOsSep, convertToPosixSep } from '../path-sep';

jest.mock('path');

describe('convertToPosixSep()', () => {
  it('should handle empty string', () => {
    expect(convertToPosixSep('')).toBe('');
  });

  it.each(['win32', 'posix'])('should convert separator from %s to posix', (type: keyof PlatformPath) => {
    const input = (path[type] as PlatformPath).join('a', 'b', 'c');
    const posix = path.posix.join('a', 'b', 'c');
    expect(convertToPosixSep(input)).toBe(posix);
  });
});

describe.each(['win32', 'posix'])('convertToOsSep() where os is %s', (osType: keyof PlatformPath) => {
  beforeAll(() => (path as any).__mockPath(osType));

  afterAll(async () => jest.restoreAllMocks());

  it.each(['win32', 'posix'])(`should convert separators from %s to ${osType}`, (inputType: keyof PlatformPath) => {
    const input = (path[inputType] as PlatformPath).join('a', 'b', 'c');
    const output = (path[osType] as PlatformPath).join('a', 'b', 'c');
    expect(convertToOsSep(input)).toBe(output);
  });
});
