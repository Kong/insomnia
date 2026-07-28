import { describe, expect, it } from 'vitest';

import { fuzzyMatch, fuzzyMatchAll } from './search';

describe('fuzzyMatch()', () => {
  it('can get a positive fuzzy match on a single field', () => {
    expect(fuzzyMatch('test', 'testing')).toEqual({
      score: -3,
      indexes: [0, 1, 2, 3],
      target: 'testing',
    });
    expect(fuzzyMatch('tst', 'testing')).toEqual({
      score: -3004,
      indexes: [0, 2, 3],
      target: 'testing',
    });
  });

  it('can get a negative fuzzy match on a single field', () => {
    // @ts-expect-error
    expect(fuzzyMatch('foo')).toBeNull();
    expect(fuzzyMatch('foo', 'bar')).toBeNull();
  });
});

describe('fuzzyMatchAll()', () => {
  it('can get a positive fuzzy match on multiple fields', () => {
    // @ts-expect-error
    expect(fuzzyMatchAll('', [undefined])).toEqual(null);
    expect(fuzzyMatchAll('', ['testing'])).toEqual(null);
    expect(fuzzyMatchAll('   ', ['testing'])).toEqual(null);
    expect(fuzzyMatchAll('test', ['testing', 'foo'])).toEqual({
      score: -3,
      indexes: [0, 1, 2, 3],
      target: 'testing foo',
    });
    expect(
      fuzzyMatchAll('test foo', ['testing', 'foo'], {
        splitSpace: true,
      }),
    ).toEqual({
      score: 0,
      indexes: [0, 1, 2, 3, 0, 1, 2],
      target: 'testing foo',
    });
    expect(fuzzyMatchAll('tst', ['testing'])).toEqual({
      score: -3004,
      indexes: [0, 2, 3],
      target: 'testing',
    });
    expect(
      fuzzyMatch('tst  this ou', 'testing this out', {
        splitSpace: true,
        loose: true,
      }),
    ).toEqual({
      score: -12.8,
      indexes: [0, 2, 3, 8, 9, 10, 11, 13, 14],
      target: 'testing this out',
    });
  });

  it('can get a negative fuzzy match on multiple fields', () => {
    // @ts-expect-error
    expect(fuzzyMatchAll('foo', [undefined])).toEqual(null);
    expect(fuzzyMatchAll('foo', ['bar'])).toEqual(null);
    expect(fuzzyMatchAll('wrong this ou', ['testing', 'this', 'out'])).toEqual(null);
  });
});
