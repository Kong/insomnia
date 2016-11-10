import {CookieJar} from 'tough-cookie';

/**
 * Get a list of cookie objects from a request.jar()
 *
 * @param jar
 */
export function cookiesFromJar (jar) {
  return new Promise(resolve => {
    jar.store.getAllCookies((err, cookies) => {
      if (err) {
        console.warn('Failed to get cookies form jar', err);
        resolve([]);
      } else {
        resolve(cookies);
      }
    });
  });
}

/**
 * Get cookies header
 * @param jar
 * @param uri
 * @returns {Promise}
 */
export function cookieHeaderValueForUri (jar, uri) {
  return new Promise(resolve => {
    jar.getCookies(uri, (err, cookies) => {
      cookies = err ? [] : cookies;
      resolve(cookies.map(c => c.cookieString()).join('; '));
    })
  })
}

/**
 * Get a request.jar() from a list of cookie objects
 *
 * @param cookies
 */
export function jarFromCookies (cookies) {
  let jar;

  try {
    // For some reason, fromJSON modifies `cookies`. Create a copy first
    // just to be sure
    const copy = JSON.stringify({cookies});
    jar = CookieJar.fromJSON(copy);
  } catch (e) {
    console.log('Failed to initialize cookie jar', e);
    jar = new CookieJar();
  }

  jar.rejectPublicSuffixes = false;
  jar.looseMode = true;

  return jar
}

export function cookieToString (cookie) {
  var str = cookie.toString();

  // tough-cookie toString() doesn't put domain on all the time.
  // This hack adds when tough-cookie won't
  if (cookie.domain && cookie.hostOnly) {
    str += '; Domain=' + cookie.domain;
  }

  return str;
}
