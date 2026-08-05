import { describe, expect, it, vi } from 'vitest';

import { debounce, filterHeaders, generateId, hasAuthHeader, isNotNullOrUndefined, toKebabCase } from '../misc';

describe('hasAuthHeader()', () => {
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
  it('handles bad headers', () => {
    // @ts-expect-error
    expect(filterHeaders(null, null)).toEqual([]);
    // @ts-expect-error
    expect(filterHeaders([], null)).toEqual([]);
    // @ts-expect-error
    expect(filterHeaders(['bad'], null)).toEqual([]);
    // @ts-expect-error
    expect(filterHeaders(['bad'], 'good')).toEqual([]);
    // @ts-expect-error
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
            // @ts-expect-error
            name: 123,
            // @ts-expect-error
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
        // @ts-expect-error
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
        // @ts-expect-error
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

describe('debounce()', () => {
  it('debounces correctly', () => {
    vi.useFakeTimers();
    const resultList: unknown[][] = [];
    const fn = debounce((...args: unknown[]) => {
      resultList.push(args);
    }, 100);
    fn('foo');
    fn('foo');
    fn('multi', 'foo', 'bar', 'baz');
    fn('baz', 'bar');
    fn('foo', 'bar3');
    expect(resultList).toEqual([]);
    vi.runOnlyPendingTimers();
    expect(resultList).toEqual([['foo', 'bar3']]);
  });
});

describe('isNotNullOrUndefined', () => {
  it('should return correctly', () => {
    expect(isNotNullOrUndefined(0)).toBe(true);
    expect(isNotNullOrUndefined('')).toBe(true);
    expect(isNotNullOrUndefined(false)).toBe(true);
    expect(isNotNullOrUndefined(null)).toBe(false);
    // @ts-expect-error
    expect(isNotNullOrUndefined()).toBe(false);
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
