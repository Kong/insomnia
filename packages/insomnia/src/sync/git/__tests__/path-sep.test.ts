import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { convertToOsSep, convertToPosixSep } from '../path-sep';

vi.mock('path');

describe('convertToPosixSep()', () => {
  it('should handle empty string', () => {
    expect(convertToPosixSep('')).toBe('');
  });

  it.each(['win32', 'posix'])('should convert separator from %s to posix', type => {
    const input = path[type].join('a', 'b', 'c');
    const posix = path.posix.join('a', 'b', 'c');
    expect(convertToPosixSep(input)).toBe(posix);
  });
});

describe.each(['win32', 'posix'])('convertToOsSep() where os is %s', osType => {
  beforeAll(() => path.__mockPath(osType));

  afterAll(() => vi.restoreAllMocks());

  it.each(['win32', 'posix'])(`should convert separators from %s to ${osType}`, inputType => {
    const input = path[inputType].join('a', 'b', 'c');
    const output = path[osType].join('a', 'b', 'c');
    expect(convertToOsSep(input)).toBe(output);
  });
});
