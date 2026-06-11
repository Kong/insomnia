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

export type Fetch = <T = void>(options: FetchConfig) => Promise<T>;

export let fetch: Fetch = <T = void>(_options: FetchConfig): Promise<T> => {
  throw new Error('Fetch has not been configured. Please call configureFetch() at application startup.');
};

let configured = false;
export function configureFetch(_fetch: Fetch) {
  if (configured) {
    throw new Error('Fetch has already been configured and cannot be re-configured.');
  }
  fetch = _fetch;
  configured = true;
}

export class ResponseFailError extends Error {
  response: Response;
  constructor(name: string, msg: string, response: Response) {
    super(msg);
    this.name = name || 'ResponseFailError';
    this.response = response;
  }
}

export const isApiError = (error: unknown): error is ResponseFailError => {
  return error instanceof ResponseFailError;
};
