'use strict';

const {CookieJar} = require('tough-cookie');
const request = require('request');

/**
 * Get a list of cookie objects from a request.jar()
 *
 * @param jar
 */
module.exports.cookiesFromJar = jar => {
  return new Promise(resolve => {
    jar._jar.store.getAllCookies((err, cookies) => {
      if (err) {
        console.warn('Failed to get cookies form jar', err);
        resolve([]);
      } else {
        resolve(cookies);
      }
    });
  });
};

/**
 * Get a request.jar() from a list of cookie objects
 *
 * @param cookies
 */
module.exports.jarFromCookies = cookies => {
  const jar = request.jar();

  try {
    jar._jar = CookieJar.fromJSON({cookies});
  } catch (e) {
    console.log('Failed to initialize cookie jar', e);
  }

  return jar;
};

module.exports.cookieToString = cookie => {
  var str = cookie.toString();

  // tough-cookie toString() doesn't put domain on all the time.
  // This hack adds when tough-cookie won't
  if (cookie.domain && cookie.hostOnly) {
    str += '; Domain=' + cookie.domain;
  }

  return str;
};
