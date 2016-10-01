import {CookieJar} from 'tough-cookie';
import request from 'request';
import * as cookieUtils from '../cookies';

describe('jarFromCookies()', () => {
  it('returns valid cookies', done => {
    const jar = cookieUtils.jarFromCookies([{
      key: 'foo',
      value: 'bar',
      domain: 'google.com'
    }]);

    jar._jar.store.getAllCookies((err, cookies) => {
      expect(cookies[0].domain).toEqual('google.com');
      expect(cookies[0].key).toEqual('foo');
      expect(cookies[0].value).toEqual('bar');
      expect(cookies[0].creation instanceof Date).toEqual(true);
      expect(cookies[0].expires).toEqual('Infinity');
      done();
    });
  });
});

describe('cookiesFromJar()', () => {
  it('returns valid jar', async () => {
    const d = new Date();
    const initialCookies = [{
      key: 'bar',
      value: 'baz',
      domain: 'insomnia.rest',
      expires: d
    }];

    const jar = request.jar();
    jar._jar = CookieJar.fromJSON({cookies: initialCookies});

    const cookies = await cookieUtils.cookiesFromJar(jar);

    expect(cookies[0].domain).toEqual('insomnia.rest');
    expect(cookies[0].key).toEqual('bar');
    expect(cookies[0].value).toEqual('baz');
    expect(cookies[0].creation instanceof Date).toEqual(true);
    expect(cookies[0].expires).toEqual(d);
  });
});
