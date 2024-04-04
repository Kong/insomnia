import fuzzysort from 'fuzzysort';
import { v4 as uuidv4 } from 'uuid';
import zlib from 'zlib';

import { DEBOUNCE_MILLIS } from './constants';

const ESCAPE_REGEX_MATCH = /[-[\]/{}()*+?.\\^$|]/g;

interface Header {
  name: string;
  value: string;
}

export function filterHeaders<T extends { name: string; value: string }>(headers: T[], name?: string): T[] {
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

/**
 * Generate an ID of the format "<MODEL_NAME>_<TIMESTAMP><RANDOM>"
 * @param prefix
 * @returns {string}
 */
export function generateId(prefix?: string) {
  const id = uuidv4().replace(/-/g, '');

  if (prefix) {
    return `${prefix}_${id}`;
  } else {
    return id;
  }
}

export function delay(milliseconds: number = DEBOUNCE_MILLIS) {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}

export function keyedDebounce<T>(
  callback: (t: Record<string, T[]>) => void,
  millis: number = DEBOUNCE_MILLIS
) {
  let timeout: NodeJS.Timeout;
  let results: Record<string, T[]> = {};
  const t = function(key: string, ...args: T[]) {
    results[key] = args;
    if (timeout) {
      clearTimeout(timeout);
    }
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
  // @ts-expect-error -- unsound contravariance
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

export function decompressObject<ObjectType>(input: string | null): ObjectType | null {
  if (typeof input !== 'string') {
    return null;
  }

  const jsonBuffer = zlib.gunzipSync(Buffer.from(input, 'base64'));
  return JSON.parse(jsonBuffer.toString('utf8')) as ObjectType;
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

export function isNotNullOrUndefined<ValueType>(
  value: ValueType | null | undefined
): value is ValueType {
  if (value === null || value === undefined) {
    return false;
  }

  return true;
}

export const toKebabCase = (value: string) => value.replace(/ /g, '-');
