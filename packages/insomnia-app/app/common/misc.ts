import fuzzysort from 'fuzzysort';
import { join as pathJoin } from 'path';
import { Readable, Writable } from 'stream';
import * as uuid from 'uuid';
import zlib from 'zlib';

import { DEBOUNCE_MILLIS, METHOD_DELETE, METHOD_OPTIONS } from './constants';

const ESCAPE_REGEX_MATCH = /[-[\]/{}()*+?.\\^$|]/g;

interface Header {
  name: string;
  value: string;
}

interface Parameter {
  name: string;
  value: string;
}

export function filterParameters<T extends Parameter>(
  parameters: T[],
  name: string,
): T[] {
  if (!Array.isArray(parameters) || !name) {
    return [];
  }

  return parameters.filter(h => (!h || !h.name ? false : h.name === name));
}

export function filterHeaders<T extends Header>(headers: T[], name?: string): T[] {
  if (!Array.isArray(headers) || !name || typeof name !== 'string') {
    return [];
  }

  return headers.filter(header => {
    // Never match against invalid headers
    if (!header || !header.name || typeof header.name !== 'string') {
      return false;
    }

    return header.name.toLowerCase() === name.toLowerCase();
  });
}

export function hasContentTypeHeader<T extends Header>(headers: T[]) {
  return filterHeaders(headers, 'content-type').length > 0;
}

export function hasContentLengthHeader<T extends Header>(headers: T[]) {
  return filterHeaders(headers, 'content-length').length > 0;
}

export function hasAuthHeader<T extends Header>(headers: T[]) {
  return filterHeaders(headers, 'authorization').length > 0;
}

export function hasAcceptHeader<T extends Header>(headers: T[]) {
  return filterHeaders(headers, 'accept').length > 0;
}

export function hasUserAgentHeader<T extends Header>(headers: T[]) {
  return filterHeaders(headers, 'user-agent').length > 0;
}

export function hasAcceptEncodingHeader<T extends Header>(headers: T[]) {
  return filterHeaders(headers, 'accept-encoding').length > 0;
}

export function getSetCookieHeaders<T extends Header>(headers: T[]): T[] {
  return filterHeaders(headers, 'set-cookie');
}

export function getLocationHeader<T extends Header>(headers: T[]): T | null {
  const matches = filterHeaders(headers, 'location');
  return matches.length ? matches[0] : null;
}

export function getContentTypeHeader<T extends Header>(headers: T[]): T | null {
  const matches = filterHeaders(headers, 'content-type');
  return matches.length ? matches[0] : null;
}

export function getMethodOverrideHeader<T extends Header>(headers: T[]): T | null {
  const matches = filterHeaders(headers, 'x-http-method-override');
  return matches.length ? matches[0] : null;
}

export function getHostHeader<T extends Header>(headers: T[]): T | null {
  const matches = filterHeaders(headers, 'host');
  return matches.length ? matches[0] : null;
}

export function getContentDispositionHeader<T extends Header>(headers: T[]): T | null {
  const matches = filterHeaders(headers, 'content-disposition');
  return matches.length ? matches[0] : null;
}

export function getContentLengthHeader<T extends Header>(headers: T[]): T | null {
  const matches = filterHeaders(headers, 'content-length');
  return matches.length ? matches[0] : null;
}

/**
 * Generate an ID of the format "<MODEL_NAME>_<TIMESTAMP><RANDOM>"
 * @param prefix
 * @returns {string}
 */
export function generateId(prefix?: string) {
  const id = uuid.v4().replace(/-/g, '');

  if (prefix) {
    return `${prefix}_${id}`;
  } else {
    return id;
  }
}

export function delay(milliseconds: number = DEBOUNCE_MILLIS) {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}

export function removeVowels(str: string) {
  return str.replace(/[aeiouyAEIOUY]/g, '');
}

export function formatMethodName(method: string) {
  let methodName = method || '';

  if (method === METHOD_DELETE || method === METHOD_OPTIONS) {
    methodName = method.slice(0, 3);
  } else if (method.length > 4) {
    methodName = removeVowels(method).slice(0, 4);
  }

  return methodName;
}

export function keyedDebounce<T extends Function>(callback: T, millis: number = DEBOUNCE_MILLIS): T {
  let timeout;
  let results = {};
  // @ts-expect-error -- TSCONVERSION
  const t: T = function(key, ...args) {
    results[key] = args;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (!Object.keys(results).length) {
        return;
      }

      callback(results);
      results = {};
    }, millis);
  };
  return t;
}

export function debounce<T extends Function>(
  callback: T,
  milliseconds: number = DEBOUNCE_MILLIS,
): T {
  // For regular debounce, just use a keyed debounce with a fixed key
  return keyedDebounce(results => {
    // eslint-disable-next-line prefer-spread -- don't know if there was a "this binding" reason for this being this way so I'm leaving it alone
    callback.apply(null, results.__key__);
  }, milliseconds).bind(null, '__key__');
}

export function describeByteSize(bytes: number, long = false) {
  bytes = Math.round(bytes * 10) / 10;
  let size;
  // NOTE: We multiply these by 2 so we don't end up with
  // values like 0 GB
  let unit;

  if (bytes < 1024 * 2) {
    size = bytes;
    unit = long ? 'bytes' : 'B';
  } else if (bytes < 1024 * 1024 * 2) {
    size = bytes / 1024;
    unit = long ? 'kilobytes' : 'KB';
  } else if (bytes < 1024 * 1024 * 1024 * 2) {
    size = bytes / 1024 / 1024;
    unit = long ? 'megabytes' : 'MB';
  } else {
    size = bytes / 1024 / 1024 / 1024;
    unit = long ? 'gigabytes' : 'GB';
  }

  const rounded = Math.round(size * 10) / 10;
  return `${rounded} ${unit}`;
}

export function nullFn() {
  // Do nothing
}

export function preventDefault(e: Event) {
  e.preventDefault();
}

export function xmlDecode(input: string) {
  const ESCAPED_CHARACTERS_MAP = {
    '&amp;': '&',
    '&quot;': '"',
    '&lt;': '<',
    '&gt;': '>',
  };

  return input.replace(/(&quot;|&lt;|&gt;|&amp;)/g, (_: string, item: keyof typeof ESCAPED_CHARACTERS_MAP) => (
    ESCAPED_CHARACTERS_MAP[item])
  );
}

export function fnOrString(v: string | ((...args: any[]) => any), ...args: any[]) {
  if (typeof v === 'string') {
    return v;
  } else {
    return v(...args);
  }
}

export function compressObject(obj: any) {
  const compressed = zlib.gzipSync(JSON.stringify(obj));
  return compressed.toString('base64');
}

export function decompressObject(input: string | null): any {
  if (typeof input !== 'string') {
    return null;
  }

  const jsonBuffer = zlib.gunzipSync(Buffer.from(input, 'base64'));
  return JSON.parse(jsonBuffer.toString('utf8'));
}

export function resolveHomePath(p: string) {
  if (p.indexOf('~/') === 0) {
    return pathJoin(process.env.HOME || '/', p.slice(1));
  } else {
    return p;
  }
}

export function jsonParseOr(str: string, fallback: any): any {
  try {
    return JSON.parse(str);
  } catch (err) {
    return fallback;
  }
}

export function escapeHTML(unsafeText: string) {
  const div = document.createElement('div');
  div.innerText = unsafeText;
  return div.innerHTML;
}

/**
 * Escape a dynamic string for use inside of a regular expression
 * @param str - string to escape
 * @returns {string} escaped string
 */
export function escapeRegex(str: string) {
  return str.replace(ESCAPE_REGEX_MATCH, '\\$&');
}

export interface FuzzyMatchOptions {
  splitSpace?: boolean;
  loose?: boolean;
}

export function fuzzyMatch(
  searchString: string,
  text: string,
  options: FuzzyMatchOptions = {},
): null | {
  score: number;
  indexes: number[];
} {
  return fuzzyMatchAll(searchString, [text], options);
}

export function fuzzyMatchAll(
  searchString: string,
  allText: string[],
  options: FuzzyMatchOptions = {},
) {
  if (!searchString || !searchString.trim()) {
    return null;
  }

  const words = searchString.split(' ').filter(w => w.trim());
  const terms = options.splitSpace ? [...words, searchString] : [searchString];
  let maxScore: number | null = null;
  let indexes: number[] = [];
  let termsMatched = 0;

  for (const term of terms) {
    let matchedTerm = false;

    for (const text of allText.filter(t => !t || t.trim())) {
      const result = fuzzysort.single(term, text);

      if (!result) {
        continue;
      }

      // Don't match garbage
      if (result.score < -8000) {
        continue;
      }

      if (maxScore === null || result.score > maxScore) {
        maxScore = result.score;
      }

      indexes = [...indexes, ...result.indexes];
      matchedTerm = true;
    }

    if (matchedTerm) {
      termsMatched++;
    }
  }

  // Make sure we match all provided terms except the last (full) one
  if (!options.loose && termsMatched < terms.length - 1) {
    return null;
  }

  if (maxScore === null) {
    return null;
  }

  return {
    score: maxScore,
    indexes,
    target: allText.join(' '),
  };
}

export async function waitForStreamToFinish(stream: Readable | Writable) {
  return new Promise<void>(resolve => {
    // @ts-expect-error -- access of internal values that are intended to be private.  We should _not_ do this.
    if (stream._readableState?.finished) {
      return resolve();
    }

    // @ts-expect-error -- access of internal values that are intended to be private.  We should _not_ do this.
    if (stream._writableState?.finished) {
      return resolve();
    }

    stream.on('close', () => {
      resolve();
    });
    stream.on('error', () => {
      resolve();
    });
  });
}

export function chunkArray<T>(arr: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let i = 0, j = arr.length; i < j; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }

  return chunks;
}

export function pluralize(text: string) {
  let trailer = 's';
  let chop = 0;

  // Things already ending with 's' stay that way
  if (text.match(/s$/)) {
    trailer = '';
    chop = 0;
  }

  // Things ending in 'y' convert to ies
  if (text.match(/y$/)) {
    trailer = 'ies';
    chop = 1;
  }

  // Add the trailer for pluralization
  return `${text.slice(0, text.length - chop)}${trailer}`;
}

export function diffPatchObj(baseObj: {}, patchObj: {}, deep = false) {
  const clonedBaseObj = JSON.parse(JSON.stringify(baseObj));

  for (const prop in baseObj) {
    if (!Object.prototype.hasOwnProperty.call(baseObj, prop)) {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(patchObj, prop)) {
      const left = baseObj[prop];
      const right = patchObj[prop];

      if (right !== left) {
        if (deep && isObject(left) && isObject(right)) {
          clonedBaseObj[prop] = diffPatchObj(left, right, deep);
        } else if (isObject(left) && !isObject(right)) {
          // when right is empty but left isn't, prefer left to avoid a sparse array
          clonedBaseObj[prop] = left;
        } else {
          // otherwise prefer right when both elements aren't objects to ensure values don't get overwritten
          clonedBaseObj[prop] = right;
        }
      }
    }
  }

  for (const prop in patchObj) {
    if (!Object.prototype.hasOwnProperty.call(patchObj, prop)) {
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(baseObj, prop)) {
      clonedBaseObj[prop] = patchObj[prop];
    }
  }

  return clonedBaseObj;
}

export function isObject(obj: unknown) {
  return obj !== null && typeof obj === 'object';
}

/**
  Finds epoch's digit count and converts it to make it exactly 13 digits.
  Which is the epoch millisecond representation.
*/
export function convertEpochToMilliseconds(epoch: number) {
  const expDigitCount = epoch.toString().length;
  return parseInt(String(epoch * 10 ** (13 - expDigitCount)), 10);
}

export function snapNumberToLimits(value: number, min?: number, max?: number) {
  const moreThanMax = max && !Number.isNaN(max) && value > max;
  const lessThanMin = min && !Number.isNaN(min) && value < min;

  if (moreThanMax) {
    return max;
  } else if (lessThanMin) {
    return min;
  }

  return value;
}

export function isNotNullOrUndefined<ValueType>(
  value: ValueType | null | undefined
): value is ValueType {
  if (value === null || value === undefined) return false;

  return true;
}
