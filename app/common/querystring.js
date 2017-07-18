// @flow
import type {Parameter} from '../models/request';

import * as util from './misc.js';

/** Join a URL with a querystring  */
export function joinUrl (url: string, qs: string): string {
  if (!qs) {
    return url;
  }

  if (!url) {
    return qs;
  }

  const [base, ...hashes] = url.split('#');

  // TODO: Make this work with URLs that have a #hash component
  const baseUrl = base || '';
  const joiner = getJoiner(base);
  const hash = hashes.length ? `#${hashes.join('#')}` : '';
  return `${baseUrl}${joiner}${qs}${hash}`;
}

export function extractFromUrl (url: string): string {
  if (!url) {
    return '';
  }

  // NOTE: This only splits on first ? sign. '1=2=3' --> ['1', '2=3']
  const things = url.split('?');
  if (things.length === 1) {
    return '';
  } else {
    const qsWithHash = things.slice(1).join('?');
    return qsWithHash.replace(/#.*/, '');
  }
}

export function getJoiner (url: string): string {
  url = url || '';
  return url.indexOf('?') === -1 ? '?' : '&';
}

/** Build a querystring param out of a name/value pair */
export function build (param: Parameter, strict: boolean = true): string {
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

    return `${name}=${value}`;
  } else {
    return util.flexibleEncodeComponent(param.name);
  }
}

/**
 * Build a querystring from a list of name/value pairs
 * @param parameters
 * @param strict allow empty names and values
 */
export function buildFromParams (
  parameters: Array<Parameter>,
  strict: boolean = true
): string {
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
export function deconstructToParams (qs: ?string, strict: boolean = true): Array<Parameter> {
  const pairs: Array<Parameter> = [];

  if (!qs) {
    return pairs;
  }

  const stringPairs = qs.split('&');

  for (let stringPair of stringPairs) {
    // NOTE: This only splits on first equals sign. '1=2=3' --> ['1', '2=3']
    const [encodedName, ...encodedValues] = stringPair.split('=');
    const encodedValue = encodedValues.join('=');

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
