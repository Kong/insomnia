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
});
