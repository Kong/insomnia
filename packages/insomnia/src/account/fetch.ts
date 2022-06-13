import { parse as urlParse } from 'url';
import zlib from 'zlib';

import { delay } from '../common/misc';
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

export async function postJson<T = any>(path: string, obj: unknown, sessionId: string | null, compressBody = false): Promise<T> {
  const response = await post<T>(path, obj, sessionId, compressBody);
  if (typeof response === 'string') {
    throw new Error('Unexpected plaintext response');
  }
  return response;
}

export async function put<T = any>(path: string, obj: unknown, sessionId: string | null, compressBody = false): Promise<T | string> {
  return _fetch<T>('PUT', path, obj, sessionId, compressBody);
}

export async function get<T = any>(path: string, sessionId: string | null): Promise<T | string> {
  return _fetch<T>('GET', path, null, sessionId);
}

export async function getJson<T = any>(path: string, sessionId: string | null): Promise<T> {
  const response = await get<T>(path, sessionId);
  if (typeof response === 'string') {
    throw new Error('Unexpected plaintext response');
  }
  return response;
}

async function _fetch<T = any>(
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

  const url = _getUrl(path);

  try {
    response = await window.fetch(url, config);

    // Exponential backoff for 502 errors
    if (response.status === 502 && retries < 5) {
      retries++;
      await delay(retries * 200);
      return this._fetch(method, path, obj, sessionId, compressBody, retries);
    }
  } catch (err) {
    throw new Error(`Failed to fetch '${url}'`);
  }

  const uri = response.headers.get('x-insomnia-command');
  uri && _notifyCommandListeners(uri);

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

function _getUrl(path: string) {
  if (!_baseUrl) {
    throw new Error('API base URL not configured!');
  }

  return `${_baseUrl}${path}`;
}

function _notifyCommandListeners(uri: string) {
  const parsed = urlParse(uri, true);
  const command = `${parsed.hostname}${parsed.pathname}`;
  const args = JSON.parse(JSON.stringify(parsed.query));

  _commandListeners.map(fn => fn(command, args));
}
