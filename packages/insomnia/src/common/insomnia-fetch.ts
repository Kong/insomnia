import { type FetchConfig, ResponseFailError } from 'insomnia-api';

import { getApiBaseURL, getClientString, INSOMNIA_FETCH_TIME_OUT, PLAYWRIGHT_TEST } from './constants';
import { generateId } from './misc';

type FetchImplementation = (input: string, init?: RequestInit) => Promise<Response>;

// node fetch ignores the system proxy and OS certs — main swaps in net.fetch (entry.main.ts)
let fetchImpl: FetchImplementation = (input, init) => globalThis.fetch(input, init);

export function setFetchImplementation(impl: FetchImplementation) {
  fetchImpl = impl;
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
  timeout = INSOMNIA_FETCH_TIME_OUT,
  onDeepLink,
}: FetchConfig & {
  // It's not used at all, should be removed?
  retries?: number;
  onDeepLink?: (uri: string) => void;
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
    const response = await fetchImpl((origin || getApiBaseURL()) + path, config);
    const uri = response.headers.get('x-insomnia-command');
    if (uri && onDeepLink) {
      onDeepLink(uri);
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
    if (!(err instanceof Error)) {
      throw err;
    }
    // AbortSignal.timeout() gives TimeoutError, not AbortError
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      throw new Error(`insomniaFetch timed out: ${method} ${path}`, { cause: err });
    }
    // the real error (ECONNREFUSED, cert problems) hides in err.cause, sometimes nested in an AggregateError
    const cause = (err as { cause?: string | { code?: string; message?: string; errors?: { code?: string }[] } })
      .cause;
    const detail = typeof cause === 'string' ? cause : cause?.code || cause?.errors?.[0]?.code || cause?.message;
    if (detail) {
      // fresh Error (don't mutate err.message) so a re-observed/retried error doesn't append the detail twice
      throw new Error(`${err.message} (${detail})`, { cause: err });
    }
    throw err;
  }
}
