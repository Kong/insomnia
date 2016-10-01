import {parse as urlParse, format as urlFormat} from 'url';

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

  return headers.filter(
    h => h.name.toLowerCase() === name.toLowerCase()
  );
}

export function hasAuthHeader (headers) {
  return filterHeaders(headers, 'authorization').length > 0;
}

export function getSetCookieHeaders (headers) {
  return filterHeaders(headers, 'set-cookie');
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
  const CHARS = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'.split('');
  const dateString = Date.now().toString(36);
  let randString = '';

  for (let i = 0; i < 16; i++) {
    randString += CHARS[Math.floor(Math.random() * CHARS.length)];
  }

  if (prefix) {
    return `${prefix}_${dateString}${randString}`;
  } else {
    return `${dateString}${randString}`;
  }
}

export function flexibleEncodeComponent (str) {
  // Sometimes spaces screw things up because of url.parse
  str = str.replace(/%20/g, ' ');

  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(str);
  } catch (e) {
    // Malformed (probably not encoded) so assume it's decoded already
    decodedPathname = str;
  }

  return encodeURIComponent(decodedPathname);
}

export function flexibleEncode (str) {
  // Sometimes spaces screw things up because of url.parse
  str = str.replace(/%20/g, ' ');

  let decodedPathname;
  try {
    decodedPathname = decodeURI(str);
  } catch (e) {
    // Malformed (probably not encoded) so assume it's decoded already
    decodedPathname = str;
  }

  return encodeURI(decodedPathname);
}

export function prepareUrlForSending (url) {
  const urlWithProto = setDefaultProtocol(url);

  // Parse the URL into components
  const parsedUrl = urlParse(urlWithProto, true);

  // ~~~~~~~~~~~ //
  // 1. Pathname //
  // ~~~~~~~~~~~ //

  parsedUrl.pathname = flexibleEncode(
    parsedUrl.pathname || ''
  );

  // ~~~~~~~~~~~~~~ //
  // 2. Querystring //
  // ~~~~~~~~~~~~~~ //

  // Deleting search key will force url.format to encode parsedURL.query
  delete parsedUrl.search;

  return urlFormat(parsedUrl);
}

export function delay (milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
