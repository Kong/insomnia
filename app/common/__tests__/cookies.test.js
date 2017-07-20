import {CookieJar} from 'tough-cookie';
import * as cookieUtils from '../cookies';
import {globalBeforeEach} from '../../__jest__/before-each';

describe('jarFromCookies()', () => {
  beforeEach(globalBeforeEach);
  it('returns valid cookies', done => {
    const jar = cookieUtils.jarFromCookies([{
      key: 'foo',
      value: 'bar',
      domain: 'google.com'
    }]);

    jar.store.getAllCookies((err, cookies) => {
      expect(err).toBeNull();
      expect(cookies[0].domain).toEqual('google.com');
      expect(cookies[0].key).toEqual('foo');
      expect(cookies[0].value).toEqual('bar');
      expect(cookies[0].creation instanceof Date).toEqual(true);
      expect(cookies[0].expires).toEqual('Infinity');
      done();
    });
  });

  it('handles malformed JSON', () => {
    const jar = cookieUtils.jarFromCookies('not a jar');
    expect(jar.constructor.name).toBe('CookieJar');
  });
});

describe('cookiesFromJar()', () => {
  beforeEach(globalBeforeEach);
  it('returns valid jar', async () => {
    const d = new Date();
    const initialCookies = [{
      key: 'bar',
      value: 'baz',
      domain: 'insomnia.rest',
      expires: d
    }, {
      // This one will fail to parse, and be skipped
      bad: 'cookie'
    }];

    const jar = CookieJar.fromJSON({cookies: initialCookies});

    const cookies = await cookieUtils.cookiesFromJar(jar);

    expect(cookies[0].domain).toEqual('insomnia.rest');
    expect(cookies[0].key).toEqual('bar');
    expect(cookies[0].value).toEqual('baz');
    expect(cookies[0].creation instanceof Date).toEqual(true);
    expect(cookies[0].expires).toEqual(d);
  });

  it('handles bad jar', async () => {
    const jar = CookieJar.fromJSON({cookies: []});

    // MemoryStore never actually throws errors, so lets mock the
    // function to force it to this time.
    jar.store.getAllCookies = cb => cb(new Error('Dummy Error'));
    const cookies = await cookieUtils.cookiesFromJar(jar);

    // Cookies failed to p
    expect(cookies.length).toBe(0);
  });
});

describe('cookieHeaderValueForUri()', () => {
  beforeEach(globalBeforeEach);
  it('gets cookies for valid case', async () => {
    const jar = cookieUtils.jarFromCookies([{
      key: 'foo',
      value: 'bar',
      path: '/',
      domain: 'google.com'
    }, {
      key: 'foo',
      value: 'inner',
      path: '/inner',
      domain: 'google.com'
    }]);

    expect(await cookieUtils.cookieHeaderValueForUri(jar, 'https://google.com/foo/bar'))
      .toBe('foo=bar');

    expect(await cookieUtils.cookieHeaderValueForUri(jar, 'https://insomnia.rest/'))
      .toBe('');

    expect(await cookieUtils.cookieHeaderValueForUri(jar, 'https://google.com/inner'))
      .toBe('foo=inner; foo=bar');
  });

  it('handles errors properly', async () => {
    const jar = cookieUtils.jarFromCookies([]);
    jar.getCookies = (uri, cb) => cb(new Error('Dummy error'));

    expect(
      await cookieUtils.cookieHeaderValueForUri(jar, 'https://google.com')
    ).toBe('');
  });

  describe('cookieToString()', () => {
    beforeEach(globalBeforeEach);
    it('does it\'s thing', async () => {
      const jar = cookieUtils.jarFromCookies([{
        key: 'foo',
        value: 'bar',
        path: '/',
        domain: 'google.com'
      }, {
        key: 'foo1',
        value: 'bar',
        path: '/',
        domain: 'google.com',
        hostOnly: true
      }, {
        key: 'foo2',
        value: 'bar',
        path: '/',
        domain: 'google.com',
        hostOnly: false
      }, {
        key: 'foo3',
        value: 'bar',
        path: '/somepath'
      }]);

      const cookies = await cookieUtils.cookiesFromJar(jar);

      expect(cookies.length).toBe(4);

      expect(cookieUtils.cookieToString(cookies[0]))
        .toBe('foo=bar; Domain=google.com; Path=/');

      expect(cookieUtils.cookieToString(cookies[1]))
        .toBe('foo1=bar; Path=/; Domain=google.com');

      expect(cookieUtils.cookieToString(cookies[2]))
        .toBe('foo2=bar; Domain=google.com; Path=/');

      expect(cookieUtils.cookieToString(cookies[3]))
        .toBe('foo3=bar; Path=/somepath');
    });
  });
});
