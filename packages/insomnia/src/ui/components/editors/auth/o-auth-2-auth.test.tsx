/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { convertEpochToMilliseconds } from './o-auth-2-auth';

describe('convertEpochToMilliseconds()', () => {
  it('should convert microseconds to milliseconds', () => {
    expect(convertEpochToMilliseconds(1617616858412123)).toBe(1617616858412);
  });

  it('should convert seconds to milliseconds', () => {
    expect(convertEpochToMilliseconds(1617617010)).toBe(1617617010000);
  });

  it('should output same if value already in milliseconds', () => {
    expect(convertEpochToMilliseconds(1617617141412)).toBe(1617617141412);
  });

  it('should ignore the fractional part', () => {
    expect(convertEpochToMilliseconds(1617617141412.123)).toBe(1617617141412);
    expect(convertEpochToMilliseconds(1617617141.412123)).toBe(1617617141000);
  });
});
