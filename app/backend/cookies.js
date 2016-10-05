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
  return new Promise((resolve, reject) => {
    jar.getCookies(uri, (err, cookies) => {
      if (err) {
        reject(err)
      } else {
        resolve(cookies.join('; '));
      }
    })
  })
}

/**
 * Get a request.jar() from a list of cookie objects
 *
 * @param cookies
 */
export function jarFromCookies (cookies) {
  try {
    // For some reason, fromJSON modifies `cookies`. Create a copy first
    // just to be sure
    const copy = JSON.stringify({cookies});
    return CookieJar.fromJSON(copy);
  } catch (e) {
    console.log('Failed to initialize cookie jar', e);
    return new CookieJar();
  }
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
