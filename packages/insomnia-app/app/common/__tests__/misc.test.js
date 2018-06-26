import * as misc from '../misc';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('hasAuthHeader()', () => {
  beforeEach(globalBeforeEach);
  it('finds valid header', () => {
    const yes = misc.hasAuthHeader([
      { name: 'foo', value: 'bar' },
      { name: 'authorization', value: 'foo' }
    ]);

    expect(yes).toEqual(true);
  });

  it('finds valid header case insensitive', () => {
    const yes = misc.hasAuthHeader([
      { name: 'foo', value: 'bar' },
      { name: 'AuthOrizAtiOn', value: 'foo' }
    ]);

    expect(yes).toEqual(true);
  });
});

describe('generateId()', () => {
  beforeEach(globalBeforeEach);
  it('generates a valid ID', () => {
    const id = misc.generateId('foo');
    expect(id).toMatch(/^foo_[a-z0-9]{32}$/);
  });

  it('generates without prefix', () => {
    const id = misc.generateId();
    expect(id).toMatch(/^[a-z0-9]{32}$/);
  });
});

describe('filterHeaders()', () => {
  beforeEach(globalBeforeEach);
  it('handles bad headers', () => {
    expect(misc.filterHeaders(null, null)).toEqual([]);
    expect(misc.filterHeaders([], null)).toEqual([]);
    expect(misc.filterHeaders(['bad'], null)).toEqual([]);
    expect(misc.filterHeaders(['bad'], 'good')).toEqual([]);
    expect(misc.filterHeaders(null, 'good')).toEqual([]);
    expect(
      misc.filterHeaders([{ name: 'good', value: 'valid' }], null)
    ).toEqual([]);
    expect(
      misc.filterHeaders([{ name: 'good', value: 'valid' }], 'good')
    ).toEqual([{ name: 'good', value: 'valid' }]);
  });
});

describe('keyedDebounce()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    jest.useFakeTimers();
  });

  it('debounces correctly', () => {
    const resultsList = [];
    const fn = misc.keyedDebounce(results => {
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
        multi: ['foo', 'bar', 'baz']
      }
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
    const fn = misc.debounce((...args) => {
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
    expect(
      misc.fuzzyMatch('test', 'testing').searchTermsMatched
    ).toBeGreaterThan(0);

    expect(
      misc.fuzzyMatch('tst', 'testing').searchTermsMatched
    ).toBeGreaterThan(0);
  });

  it('can get a negative fuzzy match on a single field', () => {
    expect(misc.fuzzyMatch('foo', undefined).searchTermsMatched).toEqual(0);
    expect(misc.fuzzyMatch('foo', 'bar').searchTermsMatched).toEqual(0);
  });
});

describe('fuzzyMatchAll()', () => {
  beforeEach(globalBeforeEach);
  it('can get a positive fuzzy match on multiple fields', () => {
    expect(misc.fuzzyMatchAll('', [undefined])).toEqual(true);

    expect(misc.fuzzyMatchAll('', ['testing'])).toEqual(true);
    expect(misc.fuzzyMatchAll('   ', ['testing'])).toEqual(true);
    expect(misc.fuzzyMatchAll('test', ['testing'])).toEqual(true);
    expect(misc.fuzzyMatchAll('tst', ['testing'])).toEqual(true);
    expect(
      misc.fuzzyMatchAll('tst  this ou', ['testing', 'this', 'out'])
    ).toEqual(true);
  });

  it('can get a negative fuzzy match on multiple fields', () => {
    expect(misc.fuzzyMatchAll('foo', [undefined])).toEqual(false);
    expect(misc.fuzzyMatchAll('foo', ['bar'])).toEqual(false);
    expect(
      misc.fuzzyMatchAll('wrong this ou', ['testing', 'this', 'out'])
    ).toEqual(false);
  });
});
