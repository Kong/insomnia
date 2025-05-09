import { describe, expect, it } from 'vitest';

import {
  buildQueryParameter,
  buildQueryStringFromParams,
  deconstructQueryStringToParams,
  getJoiner,
  joinUrlAndQueryString,
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

  describe('buildQueryParameter()', () => {
    it('builds simple param', () => {
      const str = buildQueryParameter({ name: 'foo', value: 'bar??' });
      expect(str).toBe('foo=bar%3F%3F');
    });

    it('builds param without value', () => {
      const str = buildQueryParameter({ name: 'foo' });
      expect(str).toBe('foo');
    });

    it('builds param with null value', () => {
      const str = buildQueryParameter({ name: 'foo', value: null });
      expect(str).toBe('foo');
    });

    it('builds param with encoded value and name', () => {
      const str = buildQueryParameter({ name: 'foo%11%09%2A%9D%0F', value: 'bar%11%09%2A%9D%0F' });
      expect(str).toBe('foo%11%09%2A%9D%0F=bar%11%09%2A%9D%0F');
    });

    it('builds param with null value and disable strict', () => {
      const str = buildQueryParameter({ name: 'foo', value: null }, false);
      expect(str).toBe('foo=');
    });

    it('builds param with spaces', () => {
      const str = buildQueryParameter({ name: 'foo bar', value: 'baz qux' });
      expect(str).toBe('foo%20bar=baz%20qux');
    });

    it('builds param with null value and enable strictNullHandling', () => {
      const str = buildQueryParameter({ name: 'foo', value: null }, true, { strictNullHandling: true });
      expect(str).toBe('foo');
    });

    it('builds param with empty string value', () => {
      const str = buildQueryParameter({ name: 'foo', value: '' });
      expect(str).toBe('foo');
    });

    it('builds param with empty string value and disable strict', () => {
      const str = buildQueryParameter({ name: 'foo', value: '' }, false);
      expect(str).toBe('foo=');
    });

    it('builds param with empty string value and enable strictNullHandling', () => {
      const str = buildQueryParameter({ name: 'foo', value: '' }, true, { strictNullHandling: true });
      expect(str).toBe('foo=');
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

    it('builds param ignore commas in the value', () => {
      const str = buildQueryParameter({ name: 'foo,', value: '1,2,3' });
      expect(str).toBe('foo%2C=1,2,3');
    });

    it('builds param without decode the commas back', () => {
      const str = buildQueryParameter({ name: 'foo', value: '1%2C' });
      expect(str).toBe('foo=1%2C');
    });

    it.fails('build query param with __ENC__ returns incorrect result', () => {
      const str = buildQueryParameter({ name: 'foo', value: '__ENC__11' });
      expect(str).toBe('foo=__ENC__11');
    });

    it.fails('build query param with __RAW__ returns incorrect result', () => {
      const str = buildQueryParameter({ name: 'foo', value: '__RAW__22' });
      expect(str).toBe('foo=__RAW__22');
    });

    it.fails('build query param with __RAW__AA throws error', () => {
      const str = buildQueryParameter({ name: 'foo', value: '__RAW__AA' });
      expect(str).toBe(expect.anything());
    });
  });

  describe('buildQueryStringFromParams()', () => {
    it('builds from params', () => {
      const str = buildQueryStringFromParams([
        { name: 'foo', value: 'bar??' },
        { name: 'foo1', value: '' },
        { name: 'foo2', value: null },
        { name: 'hello' },
        { name: 'hi there', value: 'bar??' },
        { name: '', value: 'bar??' },
        { name: '', value: '' },
      ]);

      expect(str).toBe('foo=bar%3F%3F&foo1&foo2&hello&hi%20there=bar%3F%3F');
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

    it('builds from params with strict mode and strictNullHandling', () => {
      const str = buildQueryStringFromParams(
        [
          { name: 'foo', value: 'bar??' },
          { name: 'foo1', value: '' },
          { name: 'foo2', value: null },
          { name: 'hello' },
          { name: 'hi there', value: 'bar??' },
          { name: '', value: 'bar??' },
          { name: '', value: '' },
        ],
        true,
        { strictNullHandling: true },
      );

      expect(str).toBe('foo=bar%3F%3F&foo1=&foo2&hello&hi%20there=bar%3F%3F');
    });
  });

  describe('deconstructQueryStringToParams()', () => {
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
      const str = deconstructQueryStringToParams('foo=bar%3F%3F&hello&hi%20there=bar%3F%3F&=&=val', false);

      expect(str).toEqual([
        { name: 'foo', value: 'bar??' },
        { name: 'hello', value: '' },
        { name: 'hi there', value: 'bar??' },
        { name: '', value: '' },
        { name: '', value: 'val' },
      ]);
    });

    it('builds from params with strictNullHandle', () => {
      const str = deconstructQueryStringToParams('foo=bar&foo1&foo2=', true, { strictNullHandling: true });

      expect(str).toEqual([
        { name: 'foo', value: 'bar' },
        { name: 'foo1', value: null },
        { name: 'foo2', value: '' },
      ]);
    });

    it('builds from params with skipDecode', () => {
      const str = deconstructQueryStringToParams('foo=bar%3F%3F&hello&hi%20there=bar%3F%3F&=&=val', true, {
        skipDecode: true,
      });

      expect(str).toEqual([
        { name: 'foo', value: 'bar%3F%3F' },
        { name: 'hello', value: '' },
        { name: 'hi%20there', value: 'bar%3F%3F' },
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
      const url = smartEncodeUrl('https://google.com/foo%20bar%20baz/100%25/foo/%24');
      expect(url).toBe('https://google.com/foo%20bar%20baz/100%25/foo/%24');
    });

    it('encodes querystring', () => {
      const url = smartEncodeUrl('https://google.com?s=foo bar 100%&hi$');
      expect(url).toBe('https://google.com/?s=foo%20bar%20100%25&hi%24');
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

      // Encoded should skip raw versions of $
      const url3 = smartEncodeUrl('https://google.com/$myservice');
      expect(url3).toBe('https://google.com/$myservice');

      // Encoded should skip encoded versions of $
      const url4 = smartEncodeUrl('https://google.com/%24myservice');
      expect(url4).toBe('https://google.com/%24myservice');
    });

    it('leaves already encoded characters alone', () => {
      const url = smartEncodeUrl('https://google.com/%2B%2A%2F>');
      expect(url).toBe('https://google.com/%2B%2A%2F%3E');
    });

    it("doesn't encode if last param set", () => {
      const url = smartEncodeUrl('https://google.com/%%?foo=%%', false);
      expect(url).toBe('https://google.com/%%?foo=%%');
    });

    it('Equal sign behavior with or without strictNullHandle option', () => {
      const urlEqualSign1 = smartEncodeUrl('https://google.com/terminologies?foo=bar&foo1=');
      expect(urlEqualSign1).toBe('https://google.com/terminologies?foo=bar&foo1');

      const urlNoEqualSign1 = smartEncodeUrl('https://google.com/terminologies?foo=bar&foo1');
      expect(urlNoEqualSign1).toBe('https://google.com/terminologies?foo=bar&foo1');

      const urlEqualSign2 = smartEncodeUrl('https://google.com/terminologies?foo=bar&foo1=', true, {
        strictNullHandling: true,
      });
      expect(urlEqualSign2).toBe('https://google.com/terminologies?foo=bar&foo1=');

      const urlNoEqualSign2 = smartEncodeUrl('https://google.com/terminologies?foo=bar&foo1', true, {
        strictNullHandling: true,
      });
      expect(urlNoEqualSign2).toBe('https://google.com/terminologies?foo=bar&foo1');
    });

    it('should not decode value back', () => {
      expect(
        smartEncodeUrl(
          'https://google.com/?text=%4E%C3%A4%72%20%6D%61%6E%20%74%65%73%74%61%72%20%74%65%73%74%61%72%20%6D%61%6E',
        ),
      ).toBe(
        'https://google.com/?text=%4E%C3%A4%72%20%6D%61%6E%20%74%65%73%74%61%72%20%74%65%73%74%61%72%20%6D%61%6E',
      );
    });
  });
});
