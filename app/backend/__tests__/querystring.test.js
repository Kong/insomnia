'use strict';

const querystringUtils = require('../querystring');

describe('getBasicAuthHeader()', () => {
  it('gets joiner for bare URL', () => {
    const joiner = querystringUtils.getJoiner('http://google.com');
    expect(joiner).toBe('?');
  });

  it('gets joiner for invalid URL', () => {
    const joiner = querystringUtils.getJoiner('hi');
    expect(joiner).toBe('?');
  });

  it('gets joiner for URL with question mark', () => {
    const joiner = querystringUtils.getJoiner('http://google.com?');
    expect(joiner).toBe('&');
  });

  it('gets joiner for URL with params', () => {
    const joiner = querystringUtils.getJoiner('http://google.com?foo=bar');
    expect(joiner).toBe('&');
  });

  it('gets joiner for URL with ampersand', () => {
    const joiner = querystringUtils.getJoiner(
      'http://google.com?foo=bar&baz=qux'
    );
    expect(joiner).toBe('&');
  });
});

describe('joinUrl()', () => {
  it('gets joiner for bare URL', () => {
    const url = querystringUtils.joinURL(
      'http://google.com',
      'foo=bar'
    );
    expect(url).toBe('http://google.com?foo=bar');
  });

  it('gets joiner for URL with querystring', () => {
    const url = querystringUtils.joinURL(
      'http://google.com?hi=there',
      'foo=bar%20baz'
    );
    expect(url).toBe('http://google.com?hi=there&foo=bar%20baz');
  });
});

describe('build()', () => {
  it('builds simple param', () => {
    const str = querystringUtils.build({name: 'foo', value: 'bar??'});
    expect(str).toBe('foo=bar%3F%3F');
  });

  it('builds param without value', () => {
    const str = querystringUtils.build({name: 'foo'});
    expect(str).toBe('foo');
  });

  it('builds empty param without name', () => {
    const str = querystringUtils.build({value: 'bar'});
    expect(str).toBe('');
  });
});

describe('buildFromParams()', () => {
  it('builds from params', () => {
    const str = querystringUtils.buildFromParams([
      {name: 'foo', value: 'bar??'},
      {name: 'hello'},
      {name: 'hi there', value: 'bar??'},
      {name: '', value: 'bar??'},
      {name: '', value: ''},
    ]);

    expect(str).toBe('foo=bar%3F%3F&hello&hi%20there=bar%3F%3F');
  });
  it('builds from params', () => {
    const str = querystringUtils.buildFromParams([
      {name: 'foo', value: 'bar??'},
      {name: 'hello'},
      {name: 'hi there', value: 'bar??'},
      {name: '', value: 'bar??'},
      {name: '', value: ''},
    ], false);

    expect(str).toBe('foo=bar%3F%3F&hello=undefined&hi%20there=bar%3F%3F&=bar%3F%3F&=');
  });
});

describe('deconstructToParams()', () => {
  it('builds from params', () => {
    const str = querystringUtils.deconstructToParams(
      'foo=bar%3F%3F&hello&hi%20there=bar%3F%3F&=&=val'
    );

    expect(str).toEqual([
      {name: 'foo', value: 'bar??'},
      {name: 'hello', value: ''},
      {name: 'hi there', value: 'bar??'}
    ]);
  });
});

describe('deconstructToParams()', () => {
  it('builds from params not strict', () => {
    const str = querystringUtils.deconstructToParams(
      'foo=bar%3F%3F&hello&hi%20there=bar%3F%3F&=&=val',
      false
    );

    expect(str).toEqual([
      {name: 'foo', value: 'bar??'},
      {name: 'hello', value: ''},
      {name: 'hi there', value: 'bar??'},
      {name: '', value: ''},
      {name: '', value: 'val'}
    ]);
  });
});
