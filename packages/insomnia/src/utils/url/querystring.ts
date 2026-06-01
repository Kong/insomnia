import type { IQueryStringOptions, StrictNullSearchParamsValueType } from '~/insomnia-data/common';
import { deconstructQueryStringToParams } from '~/insomnia-data/common';

import { setDefaultProtocol } from './protocol';

const ESCAPE_REGEX_MATCH = /[-[\]/{}()*+?.\\^$|]/g;

/** see list of allowed characters https://datatracker.ietf.org/doc/html/rfc3986#section-2.2 */
const RFC_3986_GENERAL_DELIMITERS = ':@'; // (unintentionally?) missing: /?#[]

/** see list of allowed characters https://datatracker.ietf.org/doc/html/rfc3986#section-2.2 */
const RFC_3986_SUB_DELIMITERS = '$+,;='; // (unintentionally?) missing: !&'()*

/** see list of allowed characters https://datatracker.ietf.org/doc/html/rfc3986#section-2.2 */
const URL_PATH_CHARACTER_WHITELIST = `${RFC_3986_GENERAL_DELIMITERS}${RFC_3986_SUB_DELIMITERS}`;

export const getJoiner = (url = '') => {
  return !url.includes('?') ? '?' : '&';
};

/**
 * Join querystring to URL
 */
export const joinUrlAndQueryString = (url: string, qs: string) => {
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
};

/**
 * Extract querystring from URL
 */
export const extractQueryStringFromUrl = (url: string) => {
  if (!url) {
    return '';
  }

  // NOTE: This only splits on first ? sign. '1=2=3' --> ['1', '2=3']
  const things = url.split('?');
  if (things.length === 1) {
    return '';
  }
  const qsWithHash = things.slice(1).join('?');
  return qsWithHash.replace(/#.*/, '');
};

/**
 * Build a querystring parameter from a param object
 */
export const buildQueryParameter = (
  param: { name?: string; value?: StrictNullSearchParamsValueType | number },

  /** allow empty names and values */
  strict?: boolean,
  /** extra options like strict handle null value */
  options?: IQueryStringOptions,
) => {
  strict = strict === undefined ? true : strict;
  const { strictNullHandling = false, encodeParams = true } = options || {};

  // Skip non-name ones in strict mode
  if (strict && !param.name) {
    return '';
  }

  // Cast number values to strings
  if (typeof param.value === 'number') {
    param.value = String(param.value);
  }

  // Keep equal sign if strictNullHandling and param value is empty string, see https://github.com/Kong/insomnia/issues/2111
  if (!strict || param.value || (strictNullHandling && param.value === '')) {
    if (!encodeParams) {
      return `${param.name}=${param.value}`;
    }
    // Don't encode ',' in values
    const value = flexibleEncodeComponent(param.value || '').replace(/%2C/gi, ',');
    const name = flexibleEncodeComponent(param.name || '');

    return `${name}=${value}`;
  }
  return flexibleEncodeComponent(param.name);
};

/**
 * Build a querystring from a list of name/value pairs
 */
export const buildQueryStringFromParams = (
  parameters: { name: string; value?: StrictNullSearchParamsValueType }[],
  /** allow empty names and values */
  strict?: boolean,
  /** extra options like strict handle null value */
  options?: IQueryStringOptions,
) => {
  strict = strict === undefined ? true : strict;
  const { strictNullHandling = false, encodeParams = true } = options || {};
  const items = [];
  for (const param of parameters) {
    const built = buildQueryParameter(param, strict, { strictNullHandling, encodeParams });
    if (!built) {
      continue;
    }
    items.push(built);
  }
  return items.join('&');
};

/**
 * Automatically encode the path and querystring components
 * @param url url to encode
 * @param encode enable encoding
 * @param options enable extra options like strict null handling
 */
export const smartEncodeUrl = (url: string, encode?: boolean, options?: IQueryStringOptions) => {
  // Default autoEncode = true if not passed
  encode = encode === undefined ? true : encode;
  // Default do not strcit handle null value
  const { strictNullHandling = false } = options || {};
  const urlWithProto = setDefaultProtocol(url);

  if (!urlWithProto) {
    return '';
  }

  if (!encode) {
    return urlWithProto;
  }
  // Parse the URL into components
  const parsedUrl = new URL(urlWithProto);

  // ~~~~~~~~~~~ //
  // 1. Pathname //
  // ~~~~~~~~~~~ //

  if (parsedUrl.pathname) {
    const segments = parsedUrl.pathname.split('/');
    parsedUrl.pathname = segments.map(s => flexibleEncodeComponent(s, URL_PATH_CHARACTER_WHITELIST)).join('/');
  }

  // ~~~~~~~~~~~~~~ //
  // 2. Querystring //
  // ~~~~~~~~~~~~~~ //

  const rawQuery = parsedUrl.search.startsWith('?') ? parsedUrl.search.slice(1) : parsedUrl.search;
  if (rawQuery) {
    const qsParams = deconstructQueryStringToParams(rawQuery, true, { strictNullHandling });
    const encodedQsParams = [];
    for (const { name, value } of qsParams) {
      encodedQsParams.push({
        name: flexibleEncodeComponent(name),
        value: strictNullHandling && value === null ? null : flexibleEncodeComponent(value as string),
      });
    }

    const query = buildQueryStringFromParams(encodedQsParams, true, { strictNullHandling });
    parsedUrl.search = query ? `?${query}` : '';
  }

  return parsedUrl.toString();
};

/**
 * URL encode a string in a flexible way
 * @param str string to encode
 * @param ignore characters to ignore
 */
export const flexibleEncodeComponent = (str = '', ignore = '') => {
  // Sometimes spaces screw things up because of url.parse
  str = str.replace(/%20/g, ' ');

  // Handle all already-encoded characters so we don't touch them
  str = str.replace(/%([0-9a-fA-F]{2})/g, '__ENC__$1');

  // Do a special encode of ignored chars, so they aren't touched.
  // This first pass, surrounds them with a special tag (anything unique
  // will work), so it can change them back later
  // Example: will replace %40 with __LEAVE_40_LEAVE__, and we'll change
  // it back to %40 at the end.
  const replacements: string[][] = [];
  for (const c of ignore) {
    const code = encodeURIComponent(c).replace('%', '');
    const raw = `__RAW__${code}`;
    replacements.push([raw, c]);
    const escaped = c.replace(ESCAPE_REGEX_MATCH, '\\$&');
    const re2 = new RegExp(escaped, 'g');
    str = str.replace(re2, raw);
  }

  // Encode it
  str = encodeURIComponent(str);

  // Put back the raw version of the ignored chars
  for (const [raw, c] of replacements) {
    str = str.replace(new RegExp(raw, 'g'), c);
  }

  // Put back the encoded version of the ignored chars
  str = str.replace(/__ENC__([0-9a-fA-F]{2})/g, '%$1');
  return str;
};
