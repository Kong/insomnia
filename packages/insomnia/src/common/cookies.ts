import type { Cookie } from 'insomnia-data';
import { Cookie as ToughCookie, CookieJar, type CookieJSON } from 'tough-cookie';

/**
 * Get a list of cookie objects from a request.jar()
 */
export const cookiesFromJar = (cookieJar: CookieJar): Promise<CookieJSON[]> => {
  return new Promise(resolve => {
    cookieJar.store.getAllCookies((err, cookies) => {
      if (err) {
        console.warn('Failed to get cookies from jar', err);
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
