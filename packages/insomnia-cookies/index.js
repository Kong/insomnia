const { CookieJar, Cookie } = require('tough-cookie');

/**
 * Get a list of cookie objects from a request.jar()
 *
 * @param jar
 */
module.exports.cookiesFromJar = function(jar) {
  return new Promise(resolve => {
    jar.store.getAllCookies((err, cookies) => {
      if (err) {
        console.warn('Failed to get cookies form jar', err);
        resolve([]);
      } else {
        // NOTE: Perform toJSON so we have a plain JS object instead of Cookie instance
        resolve(cookies.map(c => c.toJSON()));
      }
    });
  });
};

/**
 * Get a request.jar() from a list of cookie objects
 *
 * @param cookies
 */
module.exports.jarFromCookies = function(cookies) {
  let jar;

  try {
    // For some reason, fromJSON modifies `cookies`. Create a copy first
    // just to be sure
    const copy = JSON.stringify({ cookies });
    jar = CookieJar.fromJSON(copy);
  } catch (e) {
    console.log('[cookies] Failed to initialize cookie jar', e);
    jar = new CookieJar();
  }

  jar.rejectPublicSuffixes = false;
  jar.looseMode = true;

  return jar;
};

module.exports.cookieToString = function(cookie) {
  // Cookie can either be a plain JS object or Cookie instance
  if (!(cookie instanceof Cookie)) {
    cookie = Cookie.fromJSON(cookie);
  }

  let str = cookie.toString();

  // tough-cookie toString() doesn't put domain on all the time.
  // This hack adds when tough-cookie won't
  if (cookie.domain && cookie.hostOnly) {
    str += '; Domain=' + cookie.domain;
  }

  return str;
};
