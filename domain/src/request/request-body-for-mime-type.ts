import type { RequestBody, RequestHeader } from './request-shared.entity';

const CONTENT_TYPE_GRAPHQL = 'application/graphql';
const CONTENT_TYPE_JSON = 'application/json';
const CONTENT_TYPE_FORM_URLENCODED = 'application/x-www-form-urlencoded';
const CONTENT_TYPE_FORM_DATA = 'multipart/form-data';
const CONTENT_TYPE_FILE = 'application/octet-stream';
const METHOD_POST = 'POST';

/** Minimal, default-options port of insomnia-data's deconstructQueryStringToParams. */
function deconstructQueryString(qs?: string): { name: string; value: string }[] {
  if (!qs) {
    return [];
  }
  return qs.split('&').flatMap(pair => {
    const [encodedName, ...encodedValueParts] = pair.split('=');
    const encodedValue = encodedValueParts.join('=');

    let name = '';
    try {
      name = decodeURIComponent(encodedName || '');
    } catch {
      name = encodedName;
    }
    if (!name) {
      return [];
    }

    let value = '';
    try {
      value = decodeURIComponent(encodedValue || '');
    } catch {
      value = encodedValue;
    }

    return [{ name, value }];
  });
}

function graphQLBodyFrom(rawBody: string): RequestBody {
  try {
    // Only strip the newlines if rawBody is parsable JSON.
    JSON.parse(rawBody);
    return { mimeType: CONTENT_TYPE_GRAPHQL, text: rawBody.replace(/\\\\n/g, '') };
  } catch {
    return { mimeType: CONTENT_TYPE_GRAPHQL, text: rawBody };
  }
}

export interface RequestBodyForMimeTypeChange {
  body: RequestBody;
  headers: RequestHeader[];
  method?: string;
}

/**
 * Computes the body/headers (and, for GraphQL, method) a Request should switch to when its
 * mimeType changes - e.g. switching to GraphQL wraps the existing body text in a GraphQL query
 * shape, switching to a form type deconstructs the existing raw text into form params.
 */
export function getRequestBodyForMimeTypeChange(
  request: { headers: RequestHeader[]; body: RequestBody },
  mimeType: string | null,
): RequestBodyForMimeTypeChange {
  const withoutContentType = request.headers.filter(h => h?.name?.toLowerCase() !== 'content-type');

  // 'No body' selected
  if (typeof mimeType !== 'string') {
    return { body: {}, headers: withoutContentType };
  }
  if (mimeType === CONTENT_TYPE_GRAPHQL) {
    return {
      body: graphQLBodyFrom(request.body.text || ''),
      headers: [{ name: 'Content-Type', value: CONTENT_TYPE_JSON }, ...withoutContentType],
      method: METHOD_POST,
    };
  }
  if (mimeType === CONTENT_TYPE_FORM_URLENCODED || mimeType === CONTENT_TYPE_FORM_DATA) {
    const params = request.body.params || deconstructQueryString(request.body.text);
    return {
      body: { mimeType, params },
      headers: [{ name: 'Content-Type', value: mimeType }, ...withoutContentType],
    };
  }
  if (mimeType === CONTENT_TYPE_FILE) {
    return {
      body: { mimeType, fileName: '' },
      headers: [{ name: 'Content-Type', value: mimeType }, ...withoutContentType],
    };
  }
  return {
    body: { mimeType: mimeType.split(';')[0], text: request.body.text || '' },
    headers: [{ name: 'Content-Type', value: mimeType }, ...withoutContentType],
  };
}
