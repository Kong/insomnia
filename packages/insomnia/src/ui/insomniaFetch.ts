
import { getApiBaseURL, getClientString, PLAYWRIGHT } from '../common/constants';
import { delay } from '../common/misc';

interface FetchConfig {
  method: 'POST' | 'PUT' | 'GET' | 'DELETE' | 'PATCH';
  path: string;
  sessionId: string | null;
  organizationId?: string | null;
  data?: unknown;
  retries?: number;
  origin?: string;
  headers?: Record<string, string>;
}

const exponentialBackOff = async (url: string, init: RequestInit, retries = 0): Promise<Response> => {
  try {
    const response = await fetch(url, init);
    if (response.status === 502 && retries < 5) {
      retries++;
      await delay(retries * 1000);
      console.log(`Received 502 from ${url} retrying`);
      return exponentialBackOff(url, init, retries);
    }
    if (!response.ok) {
      // TODO: review error status code behaviour with backend, should we parse errors here and return response
      // or should we rethrow an error with a response object inside? should we be exposing errors to the app UI?
      console.log(`Response not OK: ${response.status} for ${url}`);
    }
    return response;
  } catch (err) {
    throw err;
  }
};

// Adds headers, retries and opens deep links returned from the api
export async function insomniaFetch<T = void>({ method, path, data, sessionId, organizationId, origin, headers }: FetchConfig): Promise<T> {
  const config: RequestInit = {
    method,
    headers: {
      ...headers,
      'X-Insomnia-Client': getClientString(),
      'X-Origin': origin || getApiBaseURL(),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
      ...(data ? { 'Content-Type': 'application/json' } : {}),
      ...(organizationId ? { 'X-Insomnia-Org-Id': organizationId } : {}),
      ...(PLAYWRIGHT ? { 'X-Mockbin-Test': 'true' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  };
  if (sessionId === undefined) {
    throw new Error(`No session ID provided to ${method}:${path}`);
  }
  const response = await exponentialBackOff((origin || getApiBaseURL()) + path, config);
  const uri = response.headers.get('x-insomnia-command');
  if (uri) {
    window.main.openDeepLink(uri);
  }
  const isJson = response.headers.get('content-type')?.includes('application/json') || path.match(/\.json$/);
  return isJson ? response.json() : response.text();
}
