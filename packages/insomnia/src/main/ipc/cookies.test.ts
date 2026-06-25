import { describe, expect, it, vi } from 'vitest';

vi.mock('../har', () => ({ getResponseCookiesFromHeaders: () => [] }));
vi.mock('./electron', () => ({ ipcMainHandle: () => { } }));

import { addSetCookiesToToughCookieJar } from './cookies';

describe('addSetCookiesToToughCookieJar', () => {
  it('persists a Secure cookie set over http', () => {
    const { cookies } = addSetCookiesToToughCookieJar({
      setCookieStrings: ['pokemon=vaporeon; Path=/; Secure'],
      currentUrl: 'http://localhost:3000/pokedex/134',
      cookieJar: [],
    });

    expect(cookies.map(c => c.key)).toContain('pokemon');
  });

  it('keeps existing cookies for other hosts', () => {
    const existing = addSetCookiesToToughCookieJar({
      setCookieStrings: ['a=1; Path=/'],
      currentUrl: 'http://rest.rodeo/',
      cookieJar: [],
    }).cookies;

    const { cookies } = addSetCookiesToToughCookieJar({
      setCookieStrings: ['b=2; Path=/'],
      currentUrl: 'http://localhost:3000/',
      cookieJar: existing,
    });

    expect(cookies.map(c => c.key)).toEqual(expect.arrayContaining(['a', 'b']));
  });
});
