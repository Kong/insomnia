import { describe, expect, it } from 'vitest';

import { addSetCookiesToToughCookieJar } from './set-cookie-util';

describe('addSetCookiesToToughCookieJar', () => {
  it('persists a Secure cookie set over http', async () => {
    const { cookies } = await addSetCookiesToToughCookieJar({
      setCookieStrings: ['pokemon=vaporeon; Path=/; Secure'],
      currentUrl: 'http://localhost:3000/pokedex/134',
      cookieJar: { cookies: [] },
    });

    expect(cookies.map(c => c.key)).toContain('pokemon');
  });

  it('keeps existing cookies for other hosts', async () => {
    const { cookies: existing } = await addSetCookiesToToughCookieJar({
      setCookieStrings: ['a=1; Path=/'],
      currentUrl: 'http://rest.rodeo/',
      cookieJar: { cookies: [] },
    });

    const { cookies } = await addSetCookiesToToughCookieJar({
      setCookieStrings: ['b=2; Path=/'],
      currentUrl: 'http://localhost:3000/',
      cookieJar: { cookies: existing },
    });

    expect(cookies.map(c => c.key)).toEqual(expect.arrayContaining(['a', 'b']));
  });

  // The cookie jar is serialized into the Git-synced file, so a cookie's `id` must survive the
  // tough-cookie round-trip (which drops it) or every Set-Cookie response would dirty the file.
  describe('cookie id stability', () => {
    const storedCookie = (key: string, id: string) => ({
      id, key, value: '1', domain: 'localhost', path: '/',
      secure: false, httpOnly: false, hostOnly: true,
    });

    it('keeps the id of a cookie when an identical Set-Cookie response is replayed', async () => {
      const cookieJar = { cookies: [storedCookie('session', 'cookie_1')] };

      const { cookies } = await addSetCookiesToToughCookieJar({
        setCookieStrings: ['session=1; Path=/'],
        currentUrl: 'http://localhost:3000/',
        cookieJar,
      });

      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toMatchObject({ id: 'cookie_1', key: 'session', value: '1', domain: 'localhost', path: '/' });
    });

    it('keeps the ids of all cookies when a response only sets one of them', async () => {
      const cookieJar = { cookies: [storedCookie('a', 'cookie_a'), storedCookie('b', 'cookie_b')] };

      const { cookies } = await addSetCookiesToToughCookieJar({
        setCookieStrings: ['a=2; Path=/'],
        currentUrl: 'http://localhost:3000/',
        cookieJar,
      });

      expect(cookies.find(c => c.key === 'a')).toMatchObject({ id: 'cookie_a', value: '2' });
      expect(cookies.find(c => c.key === 'b')).toMatchObject({ id: 'cookie_b', value: '1' });
    });

    it('does not reuse an id for a cookie with the same key on a different path', async () => {
      const cookieJar = { cookies: [storedCookie('session', 'cookie_1')] };

      const { cookies } = await addSetCookiesToToughCookieJar({
        setCookieStrings: ['session=1; Path=/other'],
        currentUrl: 'http://localhost:3000/',
        cookieJar,
      });

      expect(cookies).toHaveLength(2);
      expect(cookies.find(c => c.path === '/')?.id).toBe('cookie_1');
      expect(cookies.find(c => c.path === '/other')?.id).not.toBe('cookie_1');
    });
  });

  // A cookie value set via a response may contain Nunjucks/Liquid template syntax. Only
  // 'manual' cookies are ever rendered as templates (see cookies-modal.tsx), so every cookie
  // a response actually sets/updates must always come out tagged 'response' here, even if a
  // same-named cookie was previously tagged 'manual', so a later response can't relabel a
  // cookie it controls as 'manual' and have its value rendered.
  describe('cookie provenance', () => {
    it('tags a brand-new cookie as response-sourced', async () => {
      const { cookies } = await addSetCookiesToToughCookieJar({
        setCookieStrings: ['tracking=a={{ _.some_secret }}; Path=/'],
        currentUrl: 'http://localhost:3000/',
        cookieJar: { cookies: [] },
      });

      expect(cookies.find(c => c.key === 'tracking')?.source).toBe('response');
    });

    it('downgrades a same-name manually-tagged cookie to response-sourced when a response sets it', async () => {
      const manualCookie = {
        id: 'cookie_1', key: 'tracking', value: 'safe', domain: 'localhost', path: '/',
        secure: false, httpOnly: false, source: 'manual' as const,
      };

      const { cookies } = await addSetCookiesToToughCookieJar({
        setCookieStrings: ['tracking=a={{ _.some_secret }}; Path=/'],
        currentUrl: 'http://localhost:3000/',
        cookieJar: { cookies: [manualCookie] },
      });

      expect(cookies.find(c => c.key === 'tracking')?.source).toBe('response');
    });

    it('preserves an untouched manual cookie across an unrelated Set-Cookie response', async () => {
      const manualCookie = {
        id: 'cookie_1', key: 'untouched', value: '{{ _.base_url }}', domain: 'localhost', path: '/',
        secure: false, httpOnly: false, source: 'manual' as const,
      };

      const { cookies } = await addSetCookiesToToughCookieJar({
        setCookieStrings: ['other=1; Path=/'],
        currentUrl: 'http://localhost:3000/',
        cookieJar: { cookies: [manualCookie] },
      });

      const untouched = cookies.find(c => c.key === 'untouched');
      expect(untouched?.source).toBe('manual');
      expect(untouched?.id).toBe('cookie_1');
      const fresh = cookies.find(c => c.key === 'other');
      expect(fresh?.source).toBe('response');
    });
  });
});
