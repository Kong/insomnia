// @flow
import * as electron from 'electron';
import { Readable, Writable } from 'stream';
import fuzzysort from 'fuzzysort';
import uuid from 'uuid';
import zlib from 'zlib';
import { join as pathJoin } from 'path';
import { DEBOUNCE_MILLIS } from './constants';

const ESCAPE_REGEX_MATCH = /[-[\]/{}()*+?.\\^$|]/g;

type Header = {
  name: string,
  value: string
};

type Parameter = {
  name: string,
  value: string
};

export function filterParameters<T: Parameter>(
  parameters: Array<T>,
  name: string
): Array<T> {
  if (!Array.isArray(parameters) || !name) {
    return [];
  }

  return parameters.filter(h => (!h || !h.name ? false : h.name === name));
}

export function filterHeaders<T: Header>(
  headers: Array<T>,
  name: string
): Array<T> {
  if (!Array.isArray(headers) || !name) {
    return [];
  }

  return headers.filter(h => {
    if (!h || !h.name) {
      return false;
    } else {
      return h.name.toLowerCase() === name.toLowerCase();
    }
  });
}

export function hasContentTypeHeader<T: Header>(headers: Array<T>): boolean {
  return filterHeaders(headers, 'content-type').length > 0;
}

export function hasContentLengthHeader<T: Header>(headers: Array<T>): boolean {
  return filterHeaders(headers, 'content-length').length > 0;
}

export function hasAuthHeader<T: Header>(headers: Array<T>): boolean {
  return filterHeaders(headers, 'authorization').length > 0;
}

export function hasAcceptHeader<T: Header>(headers: Array<T>): boolean {
  return filterHeaders(headers, 'accept').length > 0;
}

export function hasUserAgentHeader<T: Header>(headers: Array<T>): boolean {
  return filterHeaders(headers, 'user-agent').length > 0;
}

export function hasAcceptEncodingHeader<T: Header>(headers: Array<T>): boolean {
  return filterHeaders(headers, 'accept-encoding').length > 0;
}

export function getSetCookieHeaders<T: Header>(headers: Array<T>): Array<T> {
  return filterHeaders(headers, 'set-cookie');
}

export function getLocationHeader<T: Header>(headers: Array<T>): T | null {
  const matches = filterHeaders(headers, 'location');
  return matches.length ? matches[0] : null;
}

export function getContentTypeHeader<T: Header>(headers: Array<T>): T | null {
  const matches = filterHeaders(headers, 'content-type');
  return matches.length ? matches[0] : null;
}

export function getHostHeader<T: Header>(headers: Array<T>): T | null {
  const matches = filterHeaders(headers, 'host');
  return matches.length ? matches[0] : null;
}

export function getContentDispositionHeader<T: Header>(
  headers: Array<T>
): T | null {
  const matches = filterHeaders(headers, 'content-disposition');
  return matches.length ? matches[0] : null;
}

export function getContentLengthHeader<T: Header>(headers: Array<T>): T | null {
  const matches = filterHeaders(headers, 'content-length');
  return matches.length ? matches[0] : null;
}

/**
 * Generate an ID of the format "<MODEL_NAME>_<TIMESTAMP><RANDOM>"
 * @param prefix
 * @returns {string}
 */
export function generateId(prefix: string): string {
  const id = uuid.v4().replace(/-/g, '');

  if (prefix) {
    return `${prefix}_${id}`;
  } else {
    return id;
  }
}

export function delay(milliseconds: number = DEBOUNCE_MILLIS): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export function removeVowels(str: string): string {
  return str.replace(/[aeiouyAEIOUY]/g, '');
}

export function keyedDebounce(
  callback: Function,
  millis: number = DEBOUNCE_MILLIS
): Function {
  let timeout;
  let results = {};

  return function(key, ...args) {
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
}

export function debounce(
  callback: Function,
  millis: number = DEBOUNCE_MILLIS
): Function {
  // For regular debounce, just use a keyed debounce with a fixed key
  return keyedDebounce(results => {
    callback.apply(null, results['__key__']);
  }, millis).bind(null, '__key__');
}

export function describeByteSize(bytes: number, long: boolean = false): string {
  bytes = Math.round(bytes * 10) / 10;
  let size;

  // NOTE: We multiply these by 2 so we don't end up with
  // values like 0 GB

  let unit = long ? 'bytes' : 'B';
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

export function nullFn(): void {
  // Do nothing
}

export function preventDefault(e: Event): void {
  e.preventDefault();
}

export function clickLink(href: string): void {
  electron.shell.openExternal(href);
}

export function fnOrString(v: string | Function, ...args: Array<any>) {
  if (typeof v === 'string') {
    return v;
  } else {
    return v(...args);
  }
}

export function compressObject(obj: any): string {
  const compressed = zlib.gzipSync(JSON.stringify(obj));
  return compressed.toString('base64');
}

export function decompressObject(input: string): any {
  const jsonBuffer = zlib.gunzipSync(Buffer.from(input, 'base64'));
  return JSON.parse(jsonBuffer.toString('utf8'));
}

export function resolveHomePath(p: string): string {
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

/**
 * Escape a dynamic string for use inside of a regular expression
 * @param str - string to escape
 * @returns {string} escaped string
 */
export function escapeRegex(str: string): string {
  return str.replace(ESCAPE_REGEX_MATCH, '\\$&');
}

export function fuzzyMatch(
  searchString: string,
  text: string
): {
  searchTermsMatched: number,
  indexes: number[]
} {
  const searchTerms = searchString.trim().split(' ');
  const emptyResults = {
    searchTermsMatched: 0,
    searchTermsCount: searchTerms.length,
    indexes: []
  };

  if (
    !searchString ||
    !searchString.trim() ||
    !searchTerms ||
    searchTerms.length === 0
  ) {
    return emptyResults;
  }

  const results = searchTerms.reduce((prevResult, nextTerm) => {
    const nextResult = fuzzysort.single(nextTerm, text);

    if (!nextResult || nextResult.score < -999) {
      return prevResult;
    }

    if (!prevResult) {
      return nextResult;
    }

    const sort = array => array.sort((a, b) => a - b);
    const uniq = array => Array.from(new Set(array));

    return {
      ...prevResult,
      ...nextResult,

      searchTermsMatched: prevResult.searchTermsMatched + 1,

      indexes: sort(uniq([...prevResult.indexes, ...nextResult.indexes]))
    };
  }, emptyResults);

  if (results.indexes.length === 0) {
    return emptyResults;
  }

  return results;
}

export function fuzzyMatchAll(
  searchString: string,
  allText: Array<string>
): boolean {
  if (!searchString || !searchString.trim()) {
    return true;
  }

  return searchString
    .split(' ')
    .map(searchTerm => searchTerm.trim())
    .filter(searchTerm => !!searchTerm)
    .every(searchTerm =>
      allText.some(text => fuzzyMatch(searchTerm, text).searchTermsMatched > 0)
    );
}

export function getViewportSize(): string | null {
  const { BrowserWindow } = electron.remote || electron;
  const w =
    BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

  if (w) {
    const { width, height } = w.getContentBounds();
    return `${width}x${height}`;
  } else {
    // No windows open
    return null;
  }
}

export function getScreenResolution(): string {
  const { screen } = electron.remote || electron;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return `${width}x${height}`;
}

export function getUserLanguage(): string {
  const { app } = electron.remote || electron;
  return app.getLocale();
}

export async function waitForStreamToFinish(
  s: Readable | Writable
): Promise<void> {
  return new Promise(resolve => {
    if ((s: any)._readableState && (s: any)._readableState.finished) {
      return resolve();
    }

    if ((s: any)._writableState && (s: any)._writableState.finished) {
      return resolve();
    }

    s.on('close', () => {
      resolve();
    });

    s.on('error', () => {
      resolve();
    });
  });
}
