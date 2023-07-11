import { net } from 'electron';
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
// internel backoff customer headers for tracing x-command respect proxies(two way:? also be able to listen for specific messages in headers)
// external might respect proxy can disable ssl validation
// build core request thing that uses node:fetch? proxy support
// build two wrappers around core for internal and external
// note: fetch may not support conditional proxying
const exponentialBackOff = async (url: string, init: RequestInit, retries = 0): Promise<Response> => {
  try {
    const response = await net.fetch(url, init);
    if (response.status === 502 && retries < 5) {
      retries++;
      await delay(retries * 200);
      return exponentialBackOff(url, init, retries);
    }
    return response;
  } catch (err) {
    throw new Error(`Failed to fetch '${url}'`);
  }
};

export async function insomniaFetch<T = any>({ method, path, obj, sessionId, retries = 0 }: FetchConfig): Promise<T | string> {
  const config: RequestInit = {
    headers: {
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
      ...(_userAgent ? { 'X-Insomnia-Client': _userAgent } : {}),
      ...(obj ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(obj ? { body: JSON.stringify(obj) } : {}),
  };
  if (sessionId === undefined) {
    throw new Error(`No session ID provided to ${method}:${path}`);
  }

  invariant(_baseUrl, 'API base URL not configured!');
  const response = await exponentialBackOff(`${_baseUrl}${path}`, config, retries);
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
