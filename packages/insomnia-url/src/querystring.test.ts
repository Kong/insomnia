import {
  getJoiner,
  joinUrlAndQueryString,
  buildQueryParameter,
  buildQueryStringFromParams,
  deconstructQueryStringToParams,
  smartEncodeUrl,
} from './querystring';

describe('querystring', () => {
  describe('getJoiner()', () => {
    it('gets joiner for bare URL', () => {
      const joiner = getJoiner('http://google.com');
      expect(joiner).toBe('?');
    });

    it('gets joiner for invalid URL', () => {
      const joiner = getJoiner('hi');
      expect(joiner).toBe('?');
    });

    it('gets joiner for URL with question mark', () => {
      const joiner = getJoiner('http://google.com?');
      expect(joiner).toBe('&');
    });

    it('gets joiner for URL with params', () => {
      const joiner = getJoiner('http://google.com?foo=bar');
      expect(joiner).toBe('&');
    });

    it('gets joiner for URL with hash', () => {
      const joiner = getJoiner('http://google.com?foo=bar#hi');
      expect(joiner).toBe('&');
    });

    it('gets joiner for URL with ampersand', () => {
      const joiner = getJoiner('http://google.com?foo=bar&baz=qux');
      expect(joiner).toBe('&');
    });
  });

  describe('joinUrlAndQueryString()', () => {
    it('joins bare URL', () => {
      const url = joinUrlAndQueryString('http://google.com', 'foo=bar');
      expect(url).toBe('http://google.com?foo=bar');
    });

    it('joins with hash', () => {
      const url = joinUrlAndQueryString('http://google.com#hash', 'foo=bar');
      expect(url).toBe('http://google.com?foo=bar#hash');
    });

    it('joins hash and querystring', () => {
      const url = joinUrlAndQueryString('http://google.com?baz=qux#hash', 'foo=bar');
      expect(url).toBe('http://google.com?baz=qux&foo=bar#hash');
    });

    it('joins multi-hash and querystring', () => {
      const url = joinUrlAndQueryString('http://google.com?hi=there&baz=qux#hash#hi#hi', 'foo=bar');
      expect(url).toBe('http://google.com?hi=there&baz=qux&foo=bar#hash#hi#hi');
    });

    it('joins URL with querystring', () => {
      const url = joinUrlAndQueryString('http://google.com?hi=there', 'foo=bar%20baz');
      expect(url).toBe('http://google.com?hi=there&foo=bar%20baz');
    });
  });

  describe('build()', () => {
    it('builds simple param', () => {
      const str = buildQueryParameter({ name: 'foo', value: 'bar??' });
      expect(str).toBe('foo=bar%3F%3F');
    });

    it('builds param without value', () => {
      const str = buildQueryParameter({ name: 'foo' });
      expect(str).toBe('foo');
    });

    it('builds empty param without name', () => {
      const str = buildQueryParameter({ value: 'bar' });
      expect(str).toBe('');
    });

    it('builds with numbers', () => {
      const str = buildQueryParameter({ name: 'number', value: 10 });
      const str2 = buildQueryParameter({ name: 'number', value: 0 });

      expect(str).toBe('number=10');
      expect(str2).toBe('number=0');
    });
  });

  describe('buildFromParams()', () => {
    it('builds from params', () => {
      const str = buildQueryStringFromParams([
        { name: 'foo', value: 'bar??' },
        { name: 'hello' },
        { name: 'hi there', value: 'bar??' },
        { name: '', value: 'bar??' },
        { name: '', value: '' },
      ]);

      expect(str).toBe('foo=bar%3F%3F&hello&hi%20there=bar%3F%3F');
    });
    it('builds from params', () => {
      const str = buildQueryStringFromParams(
        [
          { name: 'foo', value: 'bar??' },
          { name: 'hello' },
          { name: 'hi there', value: 'bar??' },
          { name: '', value: 'bar??' },
          { name: '', value: '' },
        ],
        false,
      );

      expect(str).toBe('foo=bar%3F%3F&hello=&hi%20there=bar%3F%3F&=bar%3F%3F&=');
    });
  });

  describe('deconstructToParams()', () => {
    it('builds from params', () => {
      const str = deconstructQueryStringToParams('foo=bar%3F%3F&hello&hi%20there=bar%3F%3F&=&=val');

      expect(str).toEqual([
        { name: 'foo', value: 'bar??' },
        { name: 'hello', value: '' },
        { name: 'hi there', value: 'bar??' },
      ]);
    });
    it('builds from params with =', () => {
      const str = deconstructQueryStringToParams('foo=bar&1=2=3=4&hi');

      expect(str).toEqual([
        { name: 'foo', value: 'bar' },
        { name: '1', value: '2=3=4' },
        { name: 'hi', value: '' },
      ]);
    });

    it('builds from params not strict', () => {
      const str = deconstructQueryStringToParams(
        'foo=bar%3F%3F&hello&hi%20there=bar%3F%3F&=&=val',
        false,
      );

      expect(str).toEqual([
        { name: 'foo', value: 'bar??' },
        { name: 'hello', value: '' },
        { name: 'hi there', value: 'bar??' },
        { name: '', value: '' },
        { name: '', value: 'val' },
      ]);
    });
  });

  describe('smartEncodeUrl()', () => {
    it('does not touch normal url', () => {
      const url = smartEncodeUrl('http://google.com');
      expect(url).toBe('http://google.com/');
    });

    it('works with no protocol', () => {
      const url = smartEncodeUrl('google.com');
      expect(url).toBe('http://google.com/');
    });

    it('encodes pathname', () => {
      const url = smartEncodeUrl('https://google.com/foo bar/100%/foo');
      expect(url).toBe('https://google.com/foo%20bar/100%25/foo');
    });

    it('encodes pathname mixed encoding', () => {
      const url = smartEncodeUrl('https://google.com/foo bar baz%20qux/100%/foo%25');
      expect(url).toBe('https://google.com/foo%20bar%20baz%20qux/100%25/foo%25');
    });

    it('leaves already encoded pathname', () => {
      const url = smartEncodeUrl('https://google.com/foo%20bar%20baz/100%25/foo');
      expect(url).toBe('https://google.com/foo%20bar%20baz/100%25/foo');
    });

    it('encodes querystring', () => {
      const url = smartEncodeUrl('https://google.com?s=foo bar 100%&hi');
      expect(url).toBe('https://google.com/?s=foo%20bar%20100%25&hi');
    });

    it('encodes querystring with mixed spaces', () => {
      const url = smartEncodeUrl('https://google.com?s=foo %20100%');
      expect(url).toBe('https://google.com/?s=foo%20%20100%25');
    });

    it('encodes querystring with repeated keys', () => {
      const url = smartEncodeUrl('https://google.com/;@,!?s=foo,;@-!&s=foo %20100%');
      expect(url).toBe('https://google.com/;@,!?s=foo,%3B%40-!&s=foo%20%20100%25');
    });

    it("doesn't decode ignored characters", () => {
      // Encoded should skip raw versions of @ ; ,
      const url = smartEncodeUrl('https://google.com/@;,&^+');
      expect(url).toBe('https://google.com/@;,%26%5E+');

      // Encoded should skip encoded versions of @ ; ,
      const url2 = smartEncodeUrl('https://google.com/%40%3B%2C%26%5E');
      expect(url2).toBe('https://google.com/%40%3B%2C%26%5E');
    });

    it('leaves already encoded characters alone', () => {
      const url = smartEncodeUrl('https://google.com/%2B%2A%2F>');
      expect(url).toBe('https://google.com/%2B%2A%2F%3E');
    });

    it("doesn't encode if last param set", () => {
      const url = smartEncodeUrl('https://google.com/%%?foo=%%', false);
      expect(url).toBe('https://google.com/%%?foo=%%');
    });
  });
});
