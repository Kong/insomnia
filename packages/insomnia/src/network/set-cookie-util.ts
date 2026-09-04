import type { Cookie } from 'insomnia-data';

import { cookiesFromJar, jarFromCookies } from '../common/cookies';

const cookieIdentityKey = (cookie: Pick<Cookie, 'domain' | 'path' | 'key'>) =>
  `${cookie.domain}\0${cookie.path}\0${cookie.key}`;

export const addSetCookiesToToughCookieJar = async ({ setCookieStrings, currentUrl, cookieJar }: any) => {
  const rejectedCookies: string[] = [];
  const jar = jarFromCookies(cookieJar.cookies);
  const touchedByThisResponse = new Set<string>();
  for (const setCookieStr of setCookieStrings) {
    try {
      // The vendored tough-cookie type augmentation (types/tough-cookie.d.ts) mistypes
      // setCookieSync as returning void; it actually returns the Cookie that was set.
      const setCookie = jar.setCookieSync(setCookieStr, currentUrl) as unknown as
        | Pick<Cookie, 'domain' | 'path' | 'key'>
        | undefined;
      if (setCookie) {
        touchedByThisResponse.add(cookieIdentityKey(setCookie));
      }
    } catch (err) {
      if (err instanceof Error) {
        rejectedCookies.push(err.message);
      }
    }
  }

  // tough-cookie's serialization round-trip only preserves its own known cookie fields, so
  // `id`/`source` are lost and must be reconciled by hand: any cookie this response actually
  // set is always (re-)stamped 'response' — non-negotiably, so a server can never spoof or
  // resurrect a 'manual' tag on a cookie it controls — everything else keeps its prior identity
  // and provenance.
  const previousById = new Map((cookieJar.cookies as Cookie[]).map(cookie => [cookieIdentityKey(cookie), cookie]));
  const cookies = ((await cookiesFromJar(jar)) as Cookie[]).map(cookie => {
    const key = cookieIdentityKey(cookie);
    const previous = previousById.get(key);
    if (touchedByThisResponse.has(key)) {
      return { ...cookie, id: previous?.id ?? cookie.id, source: 'response' as const };
    }
    return { ...cookie, id: previous?.id ?? cookie.id, source: previous?.source ?? 'response' };
  });

  return { cookies, rejectedCookies };
};
