import { type FetchConfig, ResponseFailError } from 'insomnia-api';

import { getApiBaseURL, getClientString, INSOMNIA_FETCH_TIME_OUT, PLAYWRIGHT_TEST } from './constants';
import { generateId } from './misc';

// Adds headers, retries and opens deep links returned from the api
export async function insomniaFetch<T = void>({
  method,
  path,
  data,
  sessionId,
  organizationId,
  origin,
  headers,
  timeout = INSOMNIA_FETCH_TIME_OUT,
}: FetchConfig & {
  // It's not used at all, should be removed?
  retries?: number;
}): Promise<T> {
  const config: RequestInit = {
    method,
    headers: {
      ...headers,
      'X-Insomnia-Client': getClientString(),
      'insomnia-request-id': generateId('desk'),
      'X-Origin': origin || getApiBaseURL(),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
      ...(data ? { 'Content-Type': 'application/json' } : {}),
      ...(organizationId ? { 'X-Insomnia-Org-Id': organizationId } : {}),
      ...(PLAYWRIGHT_TEST ? { 'X-Mockbin-Test': 'true' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(timeout),
  };
  if (sessionId === undefined) {
    throw new Error(`No session ID provided to ${method}:${path}`);
  }

  try {
    const response = await fetch((origin || getApiBaseURL()) + path, config);
    const uri = response.headers.get('x-insomnia-command');
    if (uri) {
      window.main.openDeepLink(uri);
    }
    const isJson = response.headers.get('content-type')?.includes('application/json') || path.match(/\.json$/);
    if (!response.ok) {
      let errName = `CODE-${response.status}`;
      let errMsg = response.statusText;
      if (isJson) {
        try {
          const json = await response.json();
          if (typeof json?.error === 'string') {
            errName = json.error;
          }
          if (typeof json?.message === 'string') {
            errMsg = json.message;
          }
        } catch {}
      }
      throw new ResponseFailError(errName, errMsg, response);
    }
    return isJson ? response.json() : (response.text() as Promise<T>);
  } catch (err) {
    const error = err.name === 'AbortError' ? new Error('insomniaFetch timed out') : err;
    throw error;
  }
}
