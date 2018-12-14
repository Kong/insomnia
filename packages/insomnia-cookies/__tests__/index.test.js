const { CookieJar } = require('tough-cookie');
const { cookieToString, jarFromCookies, cookiesFromJar } = require('..');

describe('jarFromCookies()', () => {
  it('returns valid cookies', done => {
    const jar = jarFromCookies([
      {
        key: 'foo',
        value: 'bar',
        domain: 'google.com',
      },
    ]);

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
    const jar = jarFromCookies('not a jar');
    expect(jar.constructor.name).toBe('CookieJar');
  });
});

describe('cookiesFromJar()', () => {
  it('returns valid jar', async () => {
    const d = new Date();
    const initialCookies = [
      {
        key: 'bar',
        value: 'baz',
        domain: 'insomnia.rest',
        expires: d,
      },
      {
        // This one will fail to parse, and be skipped
        bad: 'cookie',
      },
    ];

    const jar = CookieJar.fromJSON({ cookies: initialCookies });

    const cookies = await cookiesFromJar(jar);

    expect(cookies[0].domain).toBe('insomnia.rest');
    expect(cookies[0].key).toBe('bar');
    expect(cookies[0].value).toBe('baz');
    expect(cookies[0].creation).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);
    expect(cookies[0].expires).toEqual(d.toISOString());
  });

  it('handles bad jar', async () => {
    const jar = CookieJar.fromJSON({ cookies: [] });

    // MemoryStore never actually throws errors, so lets mock the
    // function to force it to this time.
    jar.store.getAllCookies = cb => cb(new Error('Dummy Error'));
    const cookies = await cookiesFromJar(jar);

    // Cookies failed to p
    expect(cookies.length).toBe(0);
  });
});
