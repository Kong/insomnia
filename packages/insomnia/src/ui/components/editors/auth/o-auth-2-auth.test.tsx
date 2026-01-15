/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { convertEpochToMilliseconds } from './o-auth-2-auth';

describe('convertEpochToMilliseconds()', () => {
  it('should convert microseconds to milliseconds', () => {
    expect(convertEpochToMilliseconds(1_617_616_858_412_123)).toBe(1_617_616_858_412);
  });

  it('should convert seconds to milliseconds', () => {
    expect(convertEpochToMilliseconds(1_617_617_010)).toBe(1_617_617_010_000);
  });

  it('should output same if value already in milliseconds', () => {
    expect(convertEpochToMilliseconds(1_617_617_141_412)).toBe(1_617_617_141_412);
  });

  it('should ignore the fractional part', () => {
    expect(convertEpochToMilliseconds(1_617_617_141_412.123)).toBe(1_617_617_141_412);
    expect(convertEpochToMilliseconds(1_617_617_141.412_123)).toBe(1_617_617_141_000);
  });
});
