import { CookieJar, Cookie, CookieJSON } from 'tough-cookie';

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
export const jarFromCookies = (cookies: Cookie[]) => {
  let jar: CookieJar;

  try {
    // For some reason, fromJSON modifies `cookies`.
    // Create a copy first just to be sure.
    const copy = JSON.stringify({ cookies });
    jar = CookieJar.fromJSON(copy);
  } catch (e) {
    console.log('[cookies] Failed to initialize cookie jar', e);
    jar = new CookieJar() as CookieJar;
  }

  jar.rejectPublicSuffixes = false;
  jar.looseMode = true;

  return jar;
};

export const cookieToString = (cookie: Parameters<typeof Cookie.fromJSON>[0] | Cookie) => {
  // Cookie can either be a plain JS object or Cookie instance
  if (!(cookie instanceof Cookie)) {
    cookie = Cookie.fromJSON(cookie) as Cookie;

    if (cookie === null) {
      throw new Error(`Unable to read cookie: ${cookie}`);
    }
  }
  let str = cookie.toString();

  // tough-cookie toString() doesn't put domain on all the time.
  // This hack adds when tough-cookie won't
  if ((cookie as Cookie).domain && (cookie as Cookie).hostOnly) {
    str += `; Domain=${(cookie as Cookie).domain}`;
  }

  return str;
};
