import { parse as urlParse, format as urlFormat } from 'url';
import { setDefaultProtocol } from './protocol';

const ESCAPE_REGEX_MATCH = /[-[\]/{}()*+?.\\^$|]/g;
const URL_PATH_CHARACTER_WHITELIST = '+,;@=:';

export const getJoiner = (url: string) => {
  url = url || '';
  return url.indexOf('?') === -1 ? '?' : '&';
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
  } else {
    const qsWithHash = things.slice(1).join('?');
    return qsWithHash.replace(/#.*/, '');
  }
};

/**
 * Build a querystring parameter from a param object
 */
export const buildQueryParameter = (
  param: { name?: string; value?: string | number },

  /** allow empty names and values */
  strict?: boolean,
) => {
  strict = strict === undefined ? true : strict;

  // Skip non-name ones in strict mode
  if (strict && !param.name) {
    return '';
  }

  // Cast number values to strings
  if (typeof param.value === 'number') {
    param.value = String(param.value);
  }

  if (!strict || param.value) {
    // Don't encode ',' in values
    const value = flexibleEncodeComponent(param.value || '').replace(/%2C/gi, ',');
    const name = flexibleEncodeComponent(param.name || '');

    return `${name}=${value}`;
  } else {
    return flexibleEncodeComponent(param.name);
  }
};

/**
 * Build a querystring from a list of name/value pairs
 */
export const buildQueryStringFromParams = (
  parameters: { name: string; value?: string }[],

  /** allow empty names and values */
  strict?: boolean,
) => {
  strict = strict === undefined ? true : strict;
  const items = [];

  for (const param of parameters) {
    const built = buildQueryParameter(param, strict);

    if (!built) {
      continue;
    }

    items.push(built);
  }

  return items.join('&');
};

/**
 * Deconstruct a querystring to name/value pairs
 * @param [qs] {string}
 * @param [strict=true] {boolean} - allow empty names and values
 * @returns {{name: string, value: string}[]}
 */
export const deconstructQueryStringToParams = (
  qs: string,

  /** allow empty names and values */
  strict?: boolean,
) => {
  strict = strict === undefined ? true : strict;
  const pairs: { name: string; value: string }[] = [];

  if (!qs) {
    return pairs;
  }

  const stringPairs = qs.split('&');

  for (const stringPair of stringPairs) {
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

    pairs.push({ name, value });
  }

  return pairs;
};

/**
 * Automatically encode the path and querystring components
 * @param url url to encode
 * @param encode enable encoding
 */
export const smartEncodeUrl = (url: string, encode?: boolean) => {
  // Default autoEncode = true if not passed
  encode = encode === undefined ? true : encode;

  const urlWithProto = setDefaultProtocol(url);

  if (!encode) {
    return urlWithProto;
  } else {
    // Parse the URL into components
    const parsedUrl = urlParse(urlWithProto);

    // ~~~~~~~~~~~ //
    // 1. Pathname //
    // ~~~~~~~~~~~ //

    if (parsedUrl.pathname) {
      const segments = parsedUrl.pathname.split('/');
      parsedUrl.pathname = segments
        .map(s => flexibleEncodeComponent(s, URL_PATH_CHARACTER_WHITELIST))
        .join('/');
    }

    // ~~~~~~~~~~~~~~ //
    // 2. Querystring //
    // ~~~~~~~~~~~~~~ //

    if (parsedUrl.query) {
      const qsParams = deconstructQueryStringToParams(parsedUrl.query);
      const encodedQsParams = [];
      for (const { name, value } of qsParams) {
        encodedQsParams.push({
          name: flexibleEncodeComponent(name),
          value: flexibleEncodeComponent(value),
        });
      }

      parsedUrl.query = buildQueryStringFromParams(encodedQsParams);
      parsedUrl.search = `?${parsedUrl.query}`;
    }

    return urlFormat(parsedUrl);
  }
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
  for (const c of ignore) {
    const code = encodeURIComponent(c).replace('%', '');
    const escaped = c.replace(ESCAPE_REGEX_MATCH, '\\$&');
    const re2 = new RegExp(escaped, 'g');
    str = str.replace(re2, `__RAW__${code}`);
  }

  // Encode it
  str = encodeURIComponent(str);

  // Put back the raw version of the ignored chars
  for (const match of str.match(/__RAW__([0-9a-fA-F]{2})/g) || []) {
    const code = match.replace('__RAW__', '');
    str = str.replace(match, decodeURIComponent(`%${code}`));
  }

  // Put back the encoded version of the ignored chars
  for (const match of str.match(/__ENC__([0-9a-fA-F]{2})/g) || []) {
    const code = match.replace('__ENC__', '');
    str = str.replace(match, `%${code}`);
  }

  return str;
};
