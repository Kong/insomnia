
import { getApiBaseURL, getClientString, INSOMNIA_FETCH_TIME_OUT, PLAYWRIGHT } from '../common/constants';
import { generateId } from '../common/misc';

interface FetchConfig {
  method: 'POST' | 'PUT' | 'GET' | 'DELETE' | 'PATCH';
  path: string;
  sessionId: string | null;
  organizationId?: string | null;
  data?: unknown;
  retries?: number;
  origin?: string;
  headers?: Record<string, string>;
  timeout?: number;
  onlyResolveOnSuccess?: boolean;
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
  timeout,
  onlyResolveOnSuccess,
}: FetchConfig): Promise<T> {
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
    signal: AbortSignal.timeout(timeout || INSOMNIA_FETCH_TIME_OUT),
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
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json') || path.match(/\.json$/);

    // assume the backend is sending us a meaningful error message
    if (isJson && !response.ok && onlyResolveOnSuccess) {
      try {
        const json = await response.json();
        throw ({
          message: json?.message || '',
          error: json?.error || '',
        });
      } catch (err) {
        throw err;
      }
    }
    return isJson ? response.json() : response.text();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('insomniaFetch timed out');
    }
    throw err;
  }
}
