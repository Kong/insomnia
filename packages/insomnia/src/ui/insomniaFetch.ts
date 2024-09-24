
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
  onlyResolveOnSuccess?: boolean;
}

export class ResponseFailError extends Error {
  constructor(msg: string, response: Response) {
    super(msg);
    this.response = response;
  };
  response;
  name = 'ResponseFailError';
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
    signal: AbortSignal.timeout(INSOMNIA_FETCH_TIME_OUT),
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
    if (onlyResolveOnSuccess && !response.ok) {
      throw new ResponseFailError(
        `${response.status} ${response.statusText}`,
        response,
      );
    }
    const isJson = response.headers.get('content-type')?.includes('application/json') || path.match(/\.json$/);
    return isJson ? response.json() : response.text();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('insomniaFetch timed out');
    } else {
      throw err;
    }
  }
}
