export interface FetchConfig {
  method: 'POST' | 'PUT' | 'GET' | 'DELETE' | 'PATCH';
  path: string;
  sessionId: string | null;
  organizationId?: string | null;
  data?: unknown;
  origin?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export type Fetch<T = void> = (options: FetchConfig) => Promise<T>;

let fetch: Fetch | null = null;

let configured = false;
export function configureFetch(_fetch: Fetch) {
  if (configured) {
    throw new Error('Request adapter has already been configured.');
  }
  fetch = _fetch;
  configured = true;
}

export interface APIError {
  error: string;
  message?: string;
}

export async function request<T = void>(options: FetchConfig): Promise<T> {
  if (!fetch) {
    throw new Error('Request module has not been configured. Please call configureFetch() at application startup.');
  }

  return (fetch as Fetch<T>)(options);
}
