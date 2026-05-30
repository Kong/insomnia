import type * as Har from 'har-format';
import { Cookie as ToughCookie, CookieJar, type CookieJSON } from 'tough-cookie';

import type { Cookie } from '~/insomnia-data';

import { getSetCookieHeaders } from './misc';

/**
 * Get a list of cookie objects from a request.jar()
 */
export const cookiesFromJar = (cookieJar: CookieJar): Promise<CookieJSON[]> => {
  return new Promise(resolve => {
    cookieJar.store.getAllCookies((err, cookies) => {
      if (err) {
        console.warn('Failed to get cookies form jar', err);
        resolve([]);
      } else {
        // NOTE: Perform toJSON so we have a plain JS object instead of Cookie instance
        resolve(cookies.map(cookie => cookie.toJSON()));
      }
    });
  });
};

/**
 * Get a request.jar() from a list of cookie objects
 */
export const jarFromCookies = (cookies: Cookie[] | ToughCookie[]) => {
  let jar: CookieJar;

  try {
    const sanitizedCookies = cookies.map(cookie => ({
      ...cookie,
      // TODO: null will make getCookiesSync unhappy
      // probably it should be `undefined` when types of tough cookie is updated
      expires: cookie.expires === null || cookie.expires === undefined ? 'Infinity' : cookie.expires,
    }));
    // For some reason, fromJSON modifies `cookies`.
    // Create a copy first just to be sure.
    const copy = JSON.stringify({ cookies: sanitizedCookies });
    jar = CookieJar.fromJSON(copy);
  } catch (error) {
    console.log('[cookies] Failed to initialize cookie jar', error);
    jar = new CookieJar() as CookieJar;
  }

  jar.rejectPublicSuffixes = false;
  jar.looseMode = true;

  return jar;
};

export function mapCookie(cookie: ToughCookie): Har.Cookie {
  const harCookie: Har.Cookie = {
    name: cookie.key,
    value: cookie.value,
  };

  if (cookie.path) {
    harCookie.path = cookie.path;
  }

  if (cookie.domain) {
    harCookie.domain = cookie.domain;
  }

  if (cookie.expires) {
    let expires: Date | null = null;

    if (cookie.expires instanceof Date) {
      expires = cookie.expires;
    } else if (typeof cookie.expires === 'string') {
      expires = new Date(cookie.expires);
    } else if (typeof cookie.expires === 'number') {
      expires = new Date();
      expires.setTime(cookie.expires);
    }

    if (expires && !Number.isNaN(expires.getTime())) {
      harCookie.expires = expires.toISOString();
    }
  }

  if (cookie.httpOnly) {
    harCookie.httpOnly = true;
  }

  if (cookie.secure) {
    harCookie.secure = true;
  }

  return harCookie;
}

export function getResponseCookiesFromHeaders(headers: Har.Cookie[]) {
  return getSetCookieHeaders(headers).reduce((accumulator, harCookie) => {
    let cookie: null | undefined | ToughCookie = null;

    try {
      cookie = ToughCookie.parse(harCookie.value || '', { loose: true });
    } catch {}

    if (cookie === null || cookie === undefined) {
      return accumulator;
    }

    return [...accumulator, mapCookie(cookie)];
  }, [] as Har.Cookie[]);
}

export const cookieToString = (cookie: Parameters<typeof ToughCookie.fromJSON>[0] | ToughCookie) => {
  // Cookie can either be a plain JS object or Cookie instance
  if (!(cookie instanceof ToughCookie)) {
    cookie = ToughCookie.fromJSON(cookie) as ToughCookie;

    if (cookie === null) {
      throw new Error(`Unable to read cookie: ${cookie}`);
    }
  }
  let str = cookie.toString();

  // tough-cookie toString() doesn't put domain on all the time.
  // This hack adds when tough-cookie won't
  if ((cookie as ToughCookie).domain && (cookie as ToughCookie).hostOnly) {
    str += `; Domain=${(cookie as ToughCookie).domain}`;
  }

  return str;
};
