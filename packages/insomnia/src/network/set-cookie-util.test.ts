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

  // A malicious server can plant Nunjucks/Liquid template syntax in a cookie value (e.g.
  // `Set-Cookie: poc=a={{ _.some_secret }}`). Only 'manual' cookies are ever rendered as
  // templates (see cookies-modal.tsx), so every cookie a response actually sets/updates must
  // always come out tagged 'response' here — non-negotiably, even if a same-named cookie was
  // previously tagged 'manual' — otherwise a server could resurrect/spoof a 'manual' tag on a
  // cookie it controls and get its value rendered.
  describe('cookie provenance', () => {
    it('tags a brand-new cookie as response-sourced', async () => {
      const { cookies } = await addSetCookiesToToughCookieJar({
        setCookieStrings: ['poc=a={{ _.some_secret }}; Path=/'],
        currentUrl: 'http://localhost:3000/',
        cookieJar: { cookies: [] },
      });

      expect(cookies.find(c => c.key === 'poc')?.source).toBe('response');
    });

    it('downgrades a same-name manually-tagged cookie to response-sourced when a response sets it', async () => {
      const manualCookie = {
        id: 'cookie_1', key: 'poc', value: 'safe', domain: 'localhost', path: '/',
        secure: false, httpOnly: false, source: 'manual' as const,
      };

      const { cookies } = await addSetCookiesToToughCookieJar({
        setCookieStrings: ['poc=a={{ _.some_secret }}; Path=/'],
        currentUrl: 'http://localhost:3000/',
        cookieJar: { cookies: [manualCookie] },
      });

      expect(cookies.find(c => c.key === 'poc')?.source).toBe('response');
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
