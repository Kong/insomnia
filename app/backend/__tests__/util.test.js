'use strict';

const util = require('../util');

describe('getBasicAuthHeader()', () => {
  it('succeed with username and password', () => {
    const header = util.getBasicAuthHeader('user', 'password');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic dXNlcjpwYXNzd29yZA=='
    });
  });

  it('succeed with no username', () => {
    const header = util.getBasicAuthHeader(null, 'password');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic OnBhc3N3b3Jk'
    });
  });

  it('succeed with username and empty password', () => {
    const header = util.getBasicAuthHeader('user', '');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic dXNlcjo='
    });
  });

  it('succeed with username and null password', () => {
    const header = util.getBasicAuthHeader('user', null);
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic dXNlcjo='
    });
  });
});

describe('hasAuthHeader()', () => {
  it('finds valid header', () => {
    const yes = util.hasAuthHeader([
      {name: 'foo', value: 'bar'},
      {name: 'authorization', value: 'foo'}
    ]);

    expect(yes).toEqual(true);
  });

  it('finds valid header case insensitive', () => {
    const yes = util.hasAuthHeader([
      {name: 'foo', value: 'bar'},
      {name: 'AuthOrizAtiOn', value: 'foo'}
    ]);

    expect(yes).toEqual(true);
  })
});

describe('generateId()', () => {
  it('generates a valid ID', () => {
    const id = util.generateId('foo');
    expect(id).toMatch(/^foo_[a-zA-Z0-9]{24}$/);
  });

  it('generates without prefix', () => {
    const id = util.generateId();
    expect(id).toMatch(/^[a-zA-Z0-9]{24}$/);
  });
});

describe('setDefaultProtocol()', () => {
  it('correctly sets protocol for empty', () => {
    const url = util.setDefaultProtocol('google.com');
    expect(url).toBe('http://google.com');
  });

  it('does not set for valid url', () => {
    const url = util.setDefaultProtocol('https://google.com');
    expect(url).toBe('https://google.com');
  });

  it('does not set for valid url', () => {
    const url = util.setDefaultProtocol('http://google.com');
    expect(url).toBe('http://google.com');
  });

  it('does not set for invalid url', () => {
    const url = util.setDefaultProtocol('httbad://google.com');
    expect(url).toBe('httbad://google.com');
  });
});

describe('prepareUrlForSending()', () => {
  it('does not touch normal url', () => {
    const url = util.prepareUrlForSending('http://google.com');
    expect(url).toBe('http://google.com/');
  });

  it('works with no protocol', () => {
    const url = util.prepareUrlForSending('google.com');
    expect(url).toBe('http://google.com/');
  });

  it('encodes pathname', () => {
    const url = util.prepareUrlForSending('https://google.com/foo bar/100%/foo');
    expect(url).toBe('https://google.com/foo%20bar/100%25/foo');
  });

  it('encodes pathname mixed encoding', () => {
    const url = util.prepareUrlForSending('https://google.com/foo bar baz%20qux/100%/foo%25');
    expect(url).toBe('https://google.com/foo%20bar%20baz%20qux/100%25/foo%2525');
  });

  it('leaves already encoded pathname', () => {
    const url = util.prepareUrlForSending('https://google.com/foo%20bar%20baz/100%25/foo');
    expect(url).toBe('https://google.com/foo%20bar%20baz/100%25/foo');
  });

  it('encodes querystring', () => {
    const url = util.prepareUrlForSending('https://google.com?s=foo bar 100%&hi');
    expect(url).toBe('https://google.com/?s=foo%20bar%20100%25&hi=');
  });

  it('encodes querystring with mixed spaces', () => {
    const url = util.prepareUrlForSending('https://google.com?s=foo %20100%');
    expect(url).toBe('https://google.com/?s=foo%20%20100%25');
  });

  it('encodes querystring with repeated keys', () => {
    const url = util.prepareUrlForSending('https://google.com?s=foo&s=foo %20100%');
    expect(url).toBe('https://google.com/?s=foo&s=foo%20%20100%25');
  });
});
