import { isApiError } from 'insomnia-api';

class DevPortalFetchError extends Error {
  status: number;
  statusText: string;
  body?: unknown;
  operation?: string;
  constructor({
    operation,
    message,
    status,
    statusText,
    body,
  }: {
    operation?: string;
    message: string;
    status: number;
    statusText: string;
    body?: unknown;
  }) {
    super(message);
    this.name = operation ? `Failed to ${operation}` : 'Dev portal fetch error';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export interface DevPortalFetchErrorDetails {
  name: string;
  message: string;
  status?: number;
  statusText?: string;
  body?: unknown;
}

export const isDevPortalFetchError = (error: unknown): error is DevPortalFetchError => {
  return error instanceof DevPortalFetchError;
};

export const throwDevPortalFetchError = async (error: unknown, operation: string) => {
  if (isApiError(error)) {
    const { response } = error;
    const contentType = response.headers.get('content-type') || '';
    // matches application/json, application/problem+json, application/vnd.api+json, etc.
    const isJson = /json/i.test(contentType);
    const responseText = await response.text();
    let responseJson;
    if (isJson) {
      try {
        responseJson = JSON.parse(responseText);
      } catch {}
    }
    const errorBody = responseJson || responseText;
    throw new DevPortalFetchError({
      operation,
      message: `Failed to ${operation}: ${JSON.stringify(errorBody)}`,
      status: response.status,
      statusText: response.statusText,
      body: errorBody,
    });
  }
  throw error;
};

export const handleDevPortalFetchError = (error: unknown): DevPortalFetchErrorDetails => {
  if (isDevPortalFetchError(error)) {
    return {
      name: error.name,
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      body: error.body,
    };
  }
  return {
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
  };
};
