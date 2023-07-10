import { parse as urlParse } from 'url';
import zlib from 'zlib';

import { delay } from '../common/misc';
import { invariant } from '../utils/invariant';
let _userAgent = '';
let _baseUrl = '';
const _commandListeners: Function[] = [];

export function setup(userAgent: string, baseUrl: string) {
  _userAgent = userAgent;
  _baseUrl = baseUrl;
}

export function onCommand(callback: Function) {
  _commandListeners.push(callback);
}

export async function post<T = any>(path: string, obj: unknown, sessionId: string | null, compressBody = false): Promise<T | string> {
  return _fetch<T>('POST', path, obj, sessionId, compressBody);
}

export async function _fetch<T = any>(
  method: 'POST' | 'PUT' | 'GET',
  path: string,
  obj: unknown,
  sessionId: string | null,
  compressBody = false,
  retries = 0
): Promise<T | string> {
  if (sessionId === undefined) {
    throw new Error(`No session ID provided to ${method}:${path}`);
  }

  const config: {
    method: string;
    headers: Record<string, string>;
    body?: string | Buffer;
  } = {
    method: method,
    headers: {},
  };

  // Set some client information
  if (_userAgent) {
    config.headers['X-Insomnia-Client'] = _userAgent;
  }

  if (obj && compressBody) {
    config.body = zlib.gzipSync(JSON.stringify(obj));
    config.headers['Content-Type'] = 'application/json';
    config.headers['Content-Encoding'] = 'gzip';
  } else if (obj) {
    config.body = JSON.stringify(obj);
    config.headers['Content-Type'] = 'application/json';
  }

  if (sessionId) {
    config.headers['X-Session-Id'] = sessionId;
  }

  let response: Response | undefined;

  invariant(_baseUrl, 'API base URL not configured!');
  const url = `${_baseUrl}${path}`;

  try {
    response = await window.fetch(url, config);

    // Exponential backoff for 502 errors
    if (response.status === 502 && retries < 5) {
      retries++;
      await delay(retries * 200);
      return _fetch(method, path, obj, sessionId, compressBody, retries);
    }
  } catch (err) {
    throw new Error(`Failed to fetch '${url}'`);
  }

  const uri = response.headers.get('x-insomnia-command');
  if (uri) {
    const parsed = urlParse(uri, true);
    _commandListeners.map(fn => fn(`${parsed.hostname}${parsed.pathname}`, JSON.parse(JSON.stringify(parsed.query))));
  }
  if (!response.ok) {
    const err = new Error(`Response ${response.status} for ${path}`);
    err.message = await response.text();
    // @ts-expect-error -- TSCONVERSION
    err.statusCode = response.status;
    throw err;
  }

  if (response.headers.get('content-type') === 'application/json' || path.match(/\.json$/)) {
    return response.json();
  } else {
    return response.text();
  }
}
