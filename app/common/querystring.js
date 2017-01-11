import * as util from './misc.js';

/** Join a URL with a querystring  */
export function joinUrl (url, qs) {
  if (!qs) {
    return url;
  }

  // TODO: Make this work with URLs that have a #hash component
  url = url || '';
  return url + getJoiner(url) + qs;
}

export function getJoiner (url) {
  url = url || '';
  return url.indexOf('?') === -1 ? '?' : '&';
}

/** Build a querystring param out of a name/value pair */
export function build (param, strict = true) {
  // Skip non-name ones in strict mode
  if (strict && !param.name) {
    return '';
  }

  // Cast number values to strings
  if (typeof param.value === 'number') {
    param.value += '';
  }

  if (!strict || param.value) {
    // Don't encode ',' in values
    const value = util.flexibleEncodeComponent(param.value || '').replace(/%2C/gi, ',');
    const name = util.flexibleEncodeComponent(param.name || '');

    return `${name}=${value}`
  } else {
    return util.flexibleEncodeComponent(param.name);
  }
}

/**
 * Build a querystring from a list of name/value pairs
 * @param parameters
 * @param strict allow empty names and values
 */
export function buildFromParams (parameters, strict = true) {
  let items = [];

  for (const param of parameters) {
    let built = build(param, strict);

    if (!built) {
      continue;
    }

    items.push(built);
  }

  return items.join('&');
}

/**
 * Deconstruct a querystring to name/value pairs
 * @param qs
 * @param strict allow empty names and values
 */
export function deconstructToParams (qs, strict = true) {
  if (!qs) {
    return [];
  }

  const stringPairs = qs.split('&');
  const pairs = [];

  for (let stringPair of stringPairs) {
    const [encodedName, encodedValue] = stringPair.split('=');

    let name = '';
    try {
      name = decodeURIComponent(encodedName || '');
    } catch (e) {
      // Just leave it
      name = encodedName;
    }

    let value = '';
    try {
      value = decodeURIComponent(encodedValue || '');
    } catch (e) {
      // Just leave it
      value = encodedValue;
    }

    if (strict && !name) {
      continue;
    }

    pairs.push({name, value});
  }

  return pairs;
}
