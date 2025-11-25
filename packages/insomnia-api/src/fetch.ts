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

let fetchFn: Fetch | null = null;

let configured = false;
export function configureFetch(fetch: Fetch) {
  if (configured) {
    throw new Error('Fetch has already been configured and cannot be re-configured.');
  }
  fetchFn = fetch;
  configured = true;
}

export async function fetch<T = void>(options: FetchConfig): Promise<T> {
  if (!fetchFn) {
    throw new Error('Fetch has not been configured. Please call configureFetch() at application startup.');
  }

  return (fetchFn as Fetch<T>)(options);
}
