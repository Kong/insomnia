import uuid from 'uuid';
import {parse as urlParse, format as urlFormat} from 'url';
import {DEBOUNCE_MILLIS} from "./constants";
import * as querystring from './querystring';

export function getBasicAuthHeader (username, password) {
  const name = 'Authorization';
  const header = `${username || ''}:${password || ''}`;
  const authString = new Buffer(header, 'utf8').toString('base64');
  const value = `Basic ${authString}`;
  return {name, value};
}

export function filterHeaders (headers, name) {
  if (!Array.isArray(headers) || !name) {
    return [];
  }

  return headers.filter(h => {
    if (!h || !h.name) {
      return false;
    } else {
      return h.name.toLowerCase() === name.toLowerCase()
    }
  });
}

export function hasAuthHeader (headers) {
  return filterHeaders(headers, 'authorization').length > 0;
}

export function getSetCookieHeaders (headers) {
  return filterHeaders(headers, 'set-cookie');
}

export function getContentTypeHeader (headers) {
  const matches = filterHeaders(headers, 'content-type');
  return matches.length ? matches[0] : null;
}

export function getContentLengthHeader (headers) {
  const matches = filterHeaders(headers, 'content-length');
  return matches.length ? matches[0] : null;
}

export function setDefaultProtocol (url, defaultProto = 'http:') {
  // Default the proto if it doesn't exist
  if (url.indexOf('://') === -1) {
    url = `${defaultProto}//${url}`;
  }

  return url;
}

/**
 * Generate an ID of the format "<MODEL_NAME>_<TIMESTAMP><RANDOM>"
 * @param prefix
 * @returns {string}
 */
export function generateId (prefix) {
  const id = uuid.v4().replace(/-/g, '');

  if (prefix) {
    return `${prefix}_${id}`;
  } else {
    return id;
  }
}

export function flexibleEncodeComponent (str) {
  // Sometimes spaces screw things up because of url.parse
  str = str.replace(/%20/g, ' ');

  let decoded;
  try {
    decoded = decodeURIComponent(str);
  } catch (e) {
    // Malformed (probably not encoded) so assume it's decoded already
    decoded = str;
  }

  return encodeURIComponent(decoded);
}

export function prepareUrlForSending (url) {
  const urlWithProto = setDefaultProtocol(url);

  // Parse the URL into components
  const parsedUrl = urlParse(urlWithProto);

  // ~~~~~~~~~~~ //
  // 1. Pathname //
  // ~~~~~~~~~~~ //

  if (parsedUrl.pathname) {
    const segments = parsedUrl.pathname.split('/');
    parsedUrl.pathname = segments.map(flexibleEncodeComponent).join('/')
      .replace(/%3B/gi, ';') // Don't encode ; in pathname
      .replace(/%40/gi, '@') // Don't encode @ in pathname
      .replace(/%2C/gi, ','); // Don't encode , in pathname
  }

  // ~~~~~~~~~~~~~~ //
  // 2. Querystring //
  // ~~~~~~~~~~~~~~ //

  if (parsedUrl.query) {
    const qsParams = querystring.deconstructToParams(parsedUrl.query);
    const encodedQsParams = [];
    for (const {name, value} of qsParams) {
      encodedQsParams.push({
        name: flexibleEncodeComponent(name),
        value: flexibleEncodeComponent(value)
      });
    }

    parsedUrl.query = querystring.buildFromParams(encodedQsParams);
    parsedUrl.search = `?${parsedUrl.query}`;
  }

  return urlFormat(parsedUrl);
}

export function delay (milliseconds = DEBOUNCE_MILLIS) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export function removeVowels (str) {
  return str.replace(/[aeiouyAEIOUY]/g, '');
}

export function keyedDebounce (callback, millis = DEBOUNCE_MILLIS) {
  let timeout = null;
  let results = {};

  return function (key, ...args) {
    results[key] = args;

    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (!Object.keys(results).length) {
        return;
      }

      callback(results);
      results = {};
    }, millis);
  }
}

export function debounce (callback, millis = DEBOUNCE_MILLIS) {
  // For regular debounce, just use a keyed debounce with a fixed key
  return keyedDebounce(results => {
    callback.apply(null, results['__key__'])
  }, millis).bind(null, '__key__');
}
