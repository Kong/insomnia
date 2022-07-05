import { describe, expect, it } from '@jest/globals';

import { wrapToIndex } from '../utils';

describe('wrapToIndex', () => {
  it.each([
    { index: 0, maxCount: 4, result: 0 },
    { index: 1, maxCount: 4, result: 1 },
    { index: 3, maxCount: 3, result: 0 },
    { index: -1, maxCount: 3, result: 2 },
    { index: -3, maxCount: 3, result: 0 },
  ])('%p', ({ index, maxCount, result }) => {
    expect(wrapToIndex(index, maxCount)).toBe(result);
  });

  it('throws when max is negative', () => {
    const index = 1;
    const maxCount = -1;
    const execute = () => wrapToIndex(index, maxCount);
    expect(execute).toThrow();
  });
});
