import * as util from '../common/misc.js';

export function getJoiner (url) {
  url = url || '';
  return url.indexOf('?') === -1 ? '?' : '&';
}

export function joinURL (url, qs) {
  if (!qs) {
    return url;
  }
  url = url || '';
  return url + getJoiner(url) + qs;
}

export function build (param, strict = true) {
  // Skip non-name ones in strict mode
  if (strict && !param.name) {
    return '';
  }

  if (!strict || param.value) {
    const name = util.flexibleEncodeComponent(param.name || '');
    const value = util.flexibleEncodeComponent(param.value || '');
    return `${name}=${value}`
  } else {
    return util.flexibleEncodeComponent(param.name);
  }
}

/**
 *
 * @param parameters
 * @param strict allow empty names and values
 * @returns {string}
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
 *
 * @param qs
 * @param strict allow empty names and values
 * @returns {Array}
 */
export function deconstructToParams (qs, strict = true) {
  const stringPairs = qs.split('&');
  const pairs = [];

  for (let stringPair of stringPairs) {
    const tmp = stringPair.split('=');

    const name = decodeURIComponent(tmp[0] || '');
    const value = decodeURIComponent(tmp[1] || '');

    if (strict && !name) {
      continue;
    }

    pairs.push({name, value});
  }

  return pairs;
}
