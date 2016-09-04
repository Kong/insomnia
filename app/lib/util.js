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
