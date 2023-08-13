import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { globalBeforeEach } from '../../__jest__/before-each';
import { chunkArray } from '../../sync/vcs/vcs';
import {
  debounce,
  filterHeaders,
  fuzzyMatch,
  fuzzyMatchAll,
  generateId,
  hasAuthHeader,
  isNotNullOrUndefined,
  keyedDebounce,
  toKebabCase,
} from '../misc';

describe('hasAuthHeader()', () => {
  beforeEach(globalBeforeEach);

  it('finds valid header', () => {
    const yes = hasAuthHeader([
      {
        name: 'foo',
        value: 'bar',
      },
      {
        name: 'authorization',
        value: 'foo',
      },
    ]);
    expect(yes).toEqual(true);
  });

  it('finds valid header case insensitive', () => {
    const yes = hasAuthHeader([
      {
        name: 'foo',
        value: 'bar',
      },
      {
        name: 'AuthOrizAtiOn',
        value: 'foo',
      },
    ]);
    expect(yes).toEqual(true);
  });
});

describe('generateId()', () => {
  beforeEach(globalBeforeEach);

  it('generates a valid ID', () => {
    const id = generateId('foo');
    expect(id).toMatch(/^foo_[a-z0-9]{32}$/);
  });

  it('generates without prefix', () => {
    const id = generateId();
    expect(id).toMatch(/^[a-z0-9]{32}$/);
  });
});

describe('filterHeaders()', () => {
  beforeEach(globalBeforeEach);

  it('handles bad headers', () => {
    expect(filterHeaders(null, null)).toEqual([]);
    expect(filterHeaders([], null)).toEqual([]);
    expect(filterHeaders(['bad'], null)).toEqual([]);
    expect(filterHeaders(['bad'], 'good')).toEqual([]);
    expect(filterHeaders(null, 'good')).toEqual([]);
    expect(
      filterHeaders(
        [
          {
            name: '',
            value: 'valid',
          },
        ],
        '',
      ),
    ).toEqual([]);
    expect(
      filterHeaders(
        [
          {
            name: 123,
            value: 123,
          },
        ],
        123,
      ),
    ).toEqual([]);
    expect(
      filterHeaders(
        [
          {
            name: 'good',
            value: 'valid',
          },
        ],
        123,
      ),
    ).toEqual([]);
    expect(
      filterHeaders(
        [
          {
            name: 'good',
            value: 'valid',
          },
        ],
        null,
      ),
    ).toEqual([]);
    expect(
      filterHeaders(
        [
          {
            name: 'good',
            value: 'valid',
          },
        ],
        'good',
      ),
    ).toEqual([
      {
        name: 'good',
        value: 'valid',
      },
    ]);
  });
});

describe('keyedDebounce()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
  });

  it('debounces correctly', async () => {
    jest.useFakeTimers();
    const resultsList: Record<string, string[]>[] = [];
    const setter = jest.fn((result: Record<string, string[]>) => {
      resultsList.push(result);
    });
    jest.clearAllTimers();
    const fn = keyedDebounce<string>(setter, 100);
    fn('foo', 'bar');
    fn('baz', 'bar');
    fn('foo', 'bar2');
    fn('foo', 'bar3');
    fn('multi', 'foo', 'bar', 'baz');
    expect(resultsList).toEqual([]);

    jest.runAllTimers();

    expect(resultsList).toEqual([
      {
        foo: ['bar3'],
        baz: ['bar'],
        multi: ['foo', 'bar', 'baz'],
      },
    ]);
  });
});

describe('debounce()', () => {
  beforeEach(globalBeforeEach);

  it('debounces correctly', () => {
    jest.useFakeTimers();
    const resultList = [];
    const fn = debounce((...args) => {
      resultList.push(args);
    }, 100);
    fn('foo');
    fn('foo');
    fn('multi', 'foo', 'bar', 'baz');
    fn('baz', 'bar');
    fn('foo', 'bar3');
    expect(resultList).toEqual([]);
    jest.runOnlyPendingTimers();
    expect(resultList).toEqual([['foo', 'bar3']]);
  });
});

describe('fuzzyMatch()', () => {
  beforeEach(globalBeforeEach);

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
    expect(fuzzyMatch('foo', undefined)).toBeNull();
    expect(fuzzyMatch('foo', 'bar')).toBeNull();
  });
});

describe('fuzzyMatchAll()', () => {
  beforeEach(globalBeforeEach);

  it('can get a positive fuzzy match on multiple fields', () => {
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
    expect(fuzzyMatchAll('foo', [undefined])).toEqual(null);
    expect(fuzzyMatchAll('foo', ['bar'])).toEqual(null);
    expect(fuzzyMatchAll('wrong this ou', ['testing', 'this', 'out'])).toEqual(null);
  });
});
describe('chunkArray()', () => {
  it('works with exact divisor', () => {
    const chunks = chunkArray([1, 2, 3, 4, 5, 6], 3);
    expect(chunks).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('works with weird divisor', () => {
    const chunks = chunkArray([1, 2, 3, 4, 5, 6], 4);
    expect(chunks).toEqual([
      [1, 2, 3, 4],
      [5, 6],
    ]);
  });

  it('works with empty', () => {
    const chunks = chunkArray([], 4);
    expect(chunks).toEqual([]);
  });

  it('works with less than one chunk', () => {
    const chunks = chunkArray([1, 2], 4);
    expect(chunks).toEqual([[1, 2]]);
  });
});

describe('isNotNullOrUndefined', () => {
  it('should return correctly', () => {
    expect(isNotNullOrUndefined(0)).toBe(true);
    expect(isNotNullOrUndefined('')).toBe(true);
    expect(isNotNullOrUndefined(false)).toBe(true);
    expect(isNotNullOrUndefined(null)).toBe(false);
    expect(isNotNullOrUndefined(undefined)).toBe(false);
  });
});

describe('toKebabCase', () => {
  it('leaves strings without spaces alone', () => {
    expect(toKebabCase('')).toEqual('');
    expect(toKebabCase('-')).toEqual('-');
    expect(toKebabCase('a')).toEqual('a');
    expect(toKebabCase('A')).toEqual('A');
    expect(toKebabCase('aBcD')).toEqual('aBcD');
  });

  it('replease spaces with hyphens', () => {
    expect(toKebabCase('a A')).toEqual('a-A');
    expect(toKebabCase('a A b B c')).toEqual('a-A-b-B-c');
  });
});
