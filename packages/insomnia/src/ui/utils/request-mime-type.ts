import type { Request, RequestBody, RequestHeader, RequestParameter } from 'insomnia-data';
import { deconstructQueryStringToParams } from 'insomnia-data/common';

import {
  CONTENT_TYPE_FILE,
  CONTENT_TYPE_FORM_DATA,
  CONTENT_TYPE_FORM_URLENCODED,
  CONTENT_TYPE_GRAPHQL,
  CONTENT_TYPE_JSON,
  METHOD_POST,
} from '../../common/constants';

export function newBodyGraphQL(rawBody: string): RequestBody {
  try {
    // Only strip the newlines if rawBody is a parsable JSON
    JSON.parse(rawBody);
    return {
      mimeType: CONTENT_TYPE_GRAPHQL,
      text: rawBody.replace(/\\\\n/g, ''),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        mimeType: CONTENT_TYPE_GRAPHQL,
        text: rawBody,
      };
    }
    throw error;
  }
}

export const updateMimeType = (
  request: Request,
  mimeType: string | null,
): { body: RequestBody; headers: RequestHeader[]; params?: RequestParameter[]; method?: string } => {
  const withoutContentType = request.headers.filter(h => h?.name?.toLowerCase() !== 'content-type');
  // 'No body' selected
  if (typeof mimeType !== 'string') {
    return {
      body: {},
      headers: withoutContentType,
    };
  }
  if (mimeType === CONTENT_TYPE_GRAPHQL) {
    return {
      body: newBodyGraphQL(request.body.text || ''),
      headers: [{ name: 'Content-Type', value: CONTENT_TYPE_JSON }, ...withoutContentType],
      method: METHOD_POST,
    };
  }
  if (mimeType === CONTENT_TYPE_FORM_URLENCODED || mimeType === CONTENT_TYPE_FORM_DATA) {
    const params = request.body.params || deconstructQueryStringToParams(request.body.text);
    return {
      body: { mimeType, params },
      headers: [{ name: 'Content-Type', value: mimeType || '' }, ...withoutContentType],
    };
  }
  if (mimeType === CONTENT_TYPE_FILE) {
    return {
      body: { mimeType, fileName: '' },
      headers: [{ name: 'Content-Type', value: mimeType || '' }, ...withoutContentType],
    };
  }
  return {
    body: { mimeType: mimeType.split(';')[0], text: request.body.text || '' },
    headers: [{ name: 'Content-Type', value: mimeType || '' }, ...withoutContentType],
  };
};
