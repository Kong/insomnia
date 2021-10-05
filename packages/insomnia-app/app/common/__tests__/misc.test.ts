import { globalBeforeEach } from '../../__jest__/before-each';
import {
  chunkArray,
  convertEpochToMilliseconds,
  debounce,
  diffPatchObj,
  filterHeaders,
  fuzzyMatch,
  fuzzyMatchAll,
  generateId,
  hasAuthHeader,
  isNotNullOrUndefined,
  keyedDebounce,
  pluralize,
  snapNumberToLimits,
  xmlDecode,
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
    jest.useFakeTimers();
  });

  it('debounces correctly', () => {
    const resultsList = [];
    const fn = keyedDebounce(results => {
      resultsList.push(results);
    }, 100);
    fn('foo', 'bar');
    fn('baz', 'bar');
    fn('foo', 'bar2');
    fn('foo', 'bar3');
    fn('multi', 'foo', 'bar', 'baz');
    expect(setTimeout.mock.calls.length).toBe(5);
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
  beforeEach(async () => {
    await globalBeforeEach();
    jest.useFakeTimers();
  });

  it('debounces correctly', () => {
    const resultList = [];
    const fn = debounce((...args) => {
      resultList.push(args);
    }, 100);
    fn('foo');
    fn('foo');
    fn('multi', 'foo', 'bar', 'baz');
    fn('baz', 'bar');
    fn('foo', 'bar3');
    expect(setTimeout.mock.calls.length).toBe(5);
    expect(resultList).toEqual([]);
    jest.runAllTimers();
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
      score: -2004,
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
      score: -2004,
      indexes: [0, 2, 3],
      target: 'testing',
    });
    expect(
      fuzzyMatch('tst  this ou', 'testing this out', {
        splitSpace: true,
        loose: true,
      }),
    ).toEqual({
      score: -20,
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

describe('pluralize()', () => {
  it('should not change pluralization', () => {
    expect(pluralize('Requests')).toBe('Requests');
  });

  it('should end with s', () => {
    expect(pluralize('Request')).toBe('Requests');
  });

  it('should end with ies', () => {
    expect(pluralize('Directory')).toBe('Directories');
  });
});

describe('diffPatchObj()', () => {
  const a = {
    x: 1,
  };
  const b = {
    x: 2,
    y: 3,
  };
  const c = {
    x: 4,
    y: {
      z: 5,
    },
  };

  it('does a basic merge', () => {
    expect(diffPatchObj(a, b)).toEqual({
      x: 2,
      y: 3,
    });
    expect(diffPatchObj(b, a)).toEqual({
      x: 1,
      y: 3,
    });
  });

  it.skip('does a basic merge, deep', () => {
    expect(diffPatchObj(a, c, true)).toEqual({
      x: 2,
      y: 3,
    });
    expect(diffPatchObj(c, a, true)).toEqual({
      x: 1,
    });
  });

  it.skip('does a basic nested merge', () => {
    expect(diffPatchObj(a, b)).toEqual({
      x: 2,
      y: 3,
    });
    expect(diffPatchObj(b, a)).toEqual({
      x: 1,
      y: {
        z: 5,
      },
    });
  });

  it.skip('does a basic nested merge, deep', () => {
    expect(diffPatchObj(a, c, true)).toEqual({
      x: 2,
      y: 3,
    });
    expect(diffPatchObj(c, a, true)).toEqual({
      x: 1,
      y: {
        z: 5,
      },
    });
  });
});

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
});

describe('snapNumberToLimits()', () => {
  it('should return value', () => {
    expect(snapNumberToLimits(2)).toBe(2);
    expect(snapNumberToLimits(2, 0)).toBe(2);
    expect(snapNumberToLimits(2, 0, 3)).toBe(2);
    expect(snapNumberToLimits(2, 2, 2)).toBe(2);
    expect(snapNumberToLimits(2, null, null)).toBe(2);
    expect(snapNumberToLimits(2, NaN, NaN)).toBe(2);
  });

  it('should snap to min', () => {
    expect(snapNumberToLimits(2, 3)).toBe(3);
    expect(snapNumberToLimits(2, 3, 5)).toBe(3);
    expect(snapNumberToLimits(2, 3, null)).toBe(3);
    expect(snapNumberToLimits(2, 3, NaN)).toBe(3);
  });

  it('should snap to max', () => {
    expect(snapNumberToLimits(5, 0, 3)).toBe(3);
    expect(snapNumberToLimits(5, null, 3)).toBe(3);
    expect(snapNumberToLimits(5, NaN, 3)).toBe(3);
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

describe('xmlDecode()', () => {
  it('unescape characters', () => {
    const input = '&lt;a href=&quot;http://example.com?query1=value1&amp;query2=value2&quot;&gt;a link&lt;/a&gt;';
    const output = '<a href="http://example.com?query1=value1&query2=value2">a link</a>';
    expect(xmlDecode(input)).toEqual(output);
  });
});
