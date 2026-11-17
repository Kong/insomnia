import type { OpenAPIV3 } from 'openapi-types';
import YAML from 'yaml';

import { pathWithParamsAsPathParameters, pathWithParamsAsVariables, REQUEST_BASE_URL } from './path-with-params';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

// Returns the path after the importers' `REQUEST_BASE_URL` prefix, without the query/hash; null if the URL doesn't use it.
const getUrlPathname = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed.startsWith(REQUEST_BASE_URL)) {
    return null;
  }
  return trimmed.slice(REQUEST_BASE_URL.length).replace(/[?#].*$/, '');
};

export interface SpecOperationLocation {
  path: string;
  method: string;
}

// Finds the operation in an spec document, by matching the request's method and URL path against `paths`. Returns null when nothing matches.
export const findSpecOperationForRequest = (
  specContents: string,
  request: Pick<Request, 'method' | 'url'>,
): SpecOperationLocation | null => {
  const method = request.method?.toLowerCase();
  if (!HTTP_METHODS.includes(method) || !request.url) {
    return null;
  }

  let parsedSpec: OpenAPIV3.Document | null;
  try {
    parsedSpec = YAML.parse(specContents);
  } catch {
    return null;
  }
  const paths = parsedSpec?.paths;

  if (!paths || typeof paths !== 'object') {
    return null;
  }

  const requestPath = getUrlPathname(request.url);
  if (requestPath === null) {
    return null;
  }

  for (const [specPath, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object' || !(method in pathItem)) {
      continue;
    }
    // The importers build the URL as `{{ _.base_url }}<path>`; OpenAPI 3 writes params as `:param`, Swagger 2 as `{{ _.param }}`.
    const generatedPaths = [pathWithParamsAsPathParameters(specPath), pathWithParamsAsVariables(specPath)];
    if (generatedPaths.includes(requestPath)) {
      return { path: specPath, method };
    }
  }

  return null;
};
