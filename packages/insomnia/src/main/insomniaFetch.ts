import { parse as urlParse } from 'url';

import { getApiBaseURL, getClientString } from '../common/constants';
import { delay } from '../common/misc';
import { invariant } from '../utils/invariant';

const _commandListeners: Function[] = [];
export function onCommand(callback: Function) {
  _commandListeners.push(callback);
}

let _userAgent = getClientString();
let _baseUrl = getApiBaseURL();

export function setup(userAgent: string, baseUrl: string) {
  _userAgent = userAgent;
  _baseUrl = baseUrl;
}
interface FetchConfig {
  method: 'POST' | 'PUT' | 'GET';
  path: string;
  sessionId: string | null;
  obj?: unknown;
  retries?: number;
}
export async function insomniaFetch<T = any>({ method, path, obj, sessionId, retries = 0 }: FetchConfig): Promise<T | string> {
  const config: {
    method: string;
    headers: Record<string, string>;
    body?: string | Buffer;
  } = {
    method: method,
    headers: {
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
      ...(_userAgent ? { 'X-Insomnia-Client': _userAgent } : {}),
      ...(obj ? { 'Content-Type': 'application/json' } : {}),
      ...(obj ? { body: JSON.stringify(obj) } : {}),
    },
  };
  if (sessionId === undefined) {
    throw new Error(`No session ID provided to ${method}:${path}`);
  }

  invariant(_baseUrl, 'API base URL not configured!');
  const url = `${_baseUrl}${path}`;
  let response: Response | undefined;
  try {
    response = await window.fetch(url, config);

    // Exponential backoff for 502 errors
    if (response.status === 502 && retries < 5) {
      retries++;
      await delay(retries * 200);
      return insomniaFetch({ method, path, obj, sessionId, retries });
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

  const isJson = response.headers.get('content-type') === 'application/json' || path.match(/\.json$/);
  return isJson ? response.json() : response.text();
}
