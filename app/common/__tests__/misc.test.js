import * as misc from '../misc';
import {globalBeforeEach} from '../../__jest__/before-each';

describe('getBasicAuthHeader()', () => {
  beforeEach(globalBeforeEach);
  it('succeed with username and password', () => {
    const header = misc.getBasicAuthHeader('user', 'password');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic dXNlcjpwYXNzd29yZA=='
    });
  });

  it('succeed with no username', () => {
    const header = misc.getBasicAuthHeader(null, 'password');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic OnBhc3N3b3Jk'
    });
  });

  it('succeed with username and empty password', () => {
    const header = misc.getBasicAuthHeader('user', '');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic dXNlcjo='
    });
  });

  it('succeed with username and null password', () => {
    const header = misc.getBasicAuthHeader('user', null);
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic dXNlcjo='
    });
  });
});

describe('hasAuthHeader()', () => {
  beforeEach(globalBeforeEach);
  it('finds valid header', () => {
    const yes = misc.hasAuthHeader([
      {name: 'foo', value: 'bar'},
      {name: 'authorization', value: 'foo'}
    ]);

    expect(yes).toEqual(true);
  });

  it('finds valid header case insensitive', () => {
    const yes = misc.hasAuthHeader([
      {name: 'foo', value: 'bar'},
      {name: 'AuthOrizAtiOn', value: 'foo'}
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

describe('setDefaultProtocol()', () => {
  beforeEach(globalBeforeEach);
  it('no-ops on empty url', () => {
    const url = misc.setDefaultProtocol('');
    expect(url).toBe('');
  });

  it('correctly sets protocol for empty', () => {
    const url = misc.setDefaultProtocol('google.com');
    expect(url).toBe('http://google.com');
  });

  it('does not set for valid url', () => {
    const url = misc.setDefaultProtocol('https://google.com');
    expect(url).toBe('https://google.com');
  });

  it('does not set for valid url', () => {
    const url = misc.setDefaultProtocol('http://google.com');
    expect(url).toBe('http://google.com');
  });

  it('does not set for invalid url', () => {
    const url = misc.setDefaultProtocol('httbad://google.com');
    expect(url).toBe('httbad://google.com');
  });
});

describe('prepareUrlForSending()', () => {
  beforeEach(globalBeforeEach);
  it('does not touch normal url', () => {
    const url = misc.prepareUrlForSending('http://google.com');
    expect(url).toBe('http://google.com/');
  });

  it('works with no protocol', () => {
    const url = misc.prepareUrlForSending('google.com');
    expect(url).toBe('http://google.com/');
  });

  it('encodes pathname', () => {
    const url = misc.prepareUrlForSending('https://google.com/foo bar/100%/foo');
    expect(url).toBe('https://google.com/foo%20bar/100%25/foo');
  });

  it('encodes pathname mixed encoding', () => {
    const url = misc.prepareUrlForSending('https://google.com/foo bar baz%20qux/100%/foo%25');
    expect(url).toBe('https://google.com/foo%20bar%20baz%20qux/100%25/foo%25');
  });

  it('leaves already encoded pathname', () => {
    const url = misc.prepareUrlForSending('https://google.com/foo%20bar%20baz/100%25/foo');
    expect(url).toBe('https://google.com/foo%20bar%20baz/100%25/foo');
  });

  it('encodes querystring', () => {
    const url = misc.prepareUrlForSending('https://google.com?s=foo bar 100%&hi');
    expect(url).toBe('https://google.com/?s=foo%20bar%20100%25&hi');
  });

  it('encodes querystring with mixed spaces', () => {
    const url = misc.prepareUrlForSending('https://google.com?s=foo %20100%');
    expect(url).toBe('https://google.com/?s=foo%20%20100%25');
  });

  it('encodes querystring with repeated keys', () => {
    const url = misc.prepareUrlForSending('https://google.com/;@,!?s=foo,;@-!&s=foo %20100%');
    expect(url).toBe('https://google.com/;@,!?s=foo,%3B%40-!&s=foo%20%20100%25');
  });

  it('doesn\'t decode ignored characters', () => {
    // Encoded should skip raw versions of @ ; ,
    const url = misc.prepareUrlForSending('https://google.com/@;,&^+');
    expect(url).toBe('https://google.com/@;,%26%5E+');

    // Encoded should skip encoded versions of @ ; ,
    const url2 = misc.prepareUrlForSending('https://google.com/%40%3B%2C%26%5E');
    expect(url2).toBe('https://google.com/%40%3B%2C%26%5E');
  });

  it('leaves already encoded characters alone', () => {
    const url = misc.prepareUrlForSending('https://google.com/%2B%2A%2F>');
    expect(url).toBe('https://google.com/%2B%2A%2F%3E');
  });

  it('doesn\'t encode if last param set', () => {
    const url = misc.prepareUrlForSending('https://google.com/%%?foo=%%', false);
    expect(url).toBe('https://google.com/%%?foo=%%');
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
    expect(misc.filterHeaders([{name: 'good', value: 'valid'}], null)).toEqual([]);
    expect(misc.filterHeaders([{name: 'good', value: 'valid'}], 'good'))
      .toEqual([{name: 'good', value: 'valid'}]);
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

    expect(resultsList).toEqual([{
      foo: ['bar3'],
      baz: ['bar'],
      multi: ['foo', 'bar', 'baz']
    }]);
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
