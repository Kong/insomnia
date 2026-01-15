import type { FetchConfig } from 'insomnia-api';

import { getApiBaseURL, getClientString, INSOMNIA_FETCH_TIME_OUT, PLAYWRIGHT } from '../common/constants';
import { generateId } from '../common/misc';

export class ResponseFailError extends Error {
  constructor(name: string, msg: string, response: Response) {
    super(msg);
    this.name = 'ResponseFailError';
    if (name) this.name += `: ${name}`;
    this.response = response;
  }
  response;
}

// Adds headers, retries and opens deep links returned from the api
export async function insomniaFetch<T = void>({
  method,
  path,
  data,
  sessionId,
  organizationId,
  origin,
  headers,
  onlyResolveOnSuccess = false,
  timeout = INSOMNIA_FETCH_TIME_OUT,
}: FetchConfig & {
  // It's not used at all, should be removed?
  retries?: number;
  onlyResolveOnSuccess?: boolean;
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
      ...(PLAYWRIGHT ? { 'X-Mockbin-Test': 'true' } : {}),
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
    if (onlyResolveOnSuccess && !response.ok) {
      let errName = `CODE-${response.status}`,
        errMsg = response.statusText;
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
