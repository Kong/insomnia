import clone from 'clone';

import { filterHeaders } from '~/common/misc';

import type { RenderedRequest } from '../templating/types';

export function applyDefaultHeaders(
  renderedRequest: RenderedRequest,
  defaultHeaders: Record<string, any>,
): RenderedRequest {
  const request = clone(renderedRequest);
  if (!defaultHeaders || typeof defaultHeaders !== 'object' || Array.isArray(defaultHeaders)) {
    return request;
  }
  for (const name of Object.keys(defaultHeaders)) {
    const value = defaultHeaders[name];
    if (filterHeaders(request.headers, name).length) {
      console.log(`[header] Skip setting default header ${name}. Already set to ${value}`);
    } else if (value === 'null') {
      request.headers = request.headers.filter(h => !filterHeaders([h], name).length);
      console.log(`[header] Remove default header ${name}`);
    } else {
      request.headers.push({ name, value: String(value) });
      console.log(`[header] Set default header ${name}: ${value}`);
    }
  }
  return request;
}
