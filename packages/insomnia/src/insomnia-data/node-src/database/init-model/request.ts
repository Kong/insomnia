import type { Request } from 'insomnia-data';
import {
  CONTENT_TYPE_FORM_URLENCODED,
  deconstructQueryStringToParams,
  getContentTypeFromHeaders,
} from 'insomnia-data/common';

export function migrate(doc: Request): Request {
  try {
    doc = migrateBody(doc);
    doc = migrateWeirdUrls(doc);
    doc = migrateAuthType(doc);
    return doc;
  } catch (e) {
    console.log('[db] Error during request migration', e);
    throw e;
  }
}

// ~~~~~~~~~~ //
// Migrations //
// ~~~~~~~~~~ //

/**
 * Migrate old body (string) to new body (object)
 * @param request
 */
function migrateBody(request: Request) {
  if (request.body && typeof request.body === 'object') {
    return request;
  }

  // Second, convert all existing urlencoded bodies to new format
  const contentType = getContentTypeFromHeaders(request.headers) || '';
  const wasFormUrlEncoded = !!contentType.match(/^application\/x-www-form-urlencoded/i);

  if (wasFormUrlEncoded) {
    // Convert old-style form-encoded request bodies to new style
    request.body = {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: deconstructQueryStringToParams(typeof request.body === 'string' ? request.body : '', false),
    };
  } else if (!request.body && !contentType) {
    request.body = {};
  } else {
    const rawBody: string = typeof request.body === 'string' ? request.body : '';
    request.body =
      typeof contentType !== 'string'
        ? {
            text: rawBody,
          }
        : {
            mimeType: contentType.split(';')[0],
            text: rawBody,
          };
  }

  return request;
}

/**
 * Fix some weird URLs that were caused by an old bug
 * @param request
 */
function migrateWeirdUrls(request: Request) {
  // Some people seem to have requests with URLs that don't have the indexOf
  // function. This should clear that up. This can be removed at a later date.
  if (typeof request.url !== 'string') {
    request.url = '';
  }

  return request;
}

/**
 * Ensure the request.authentication.type property is added
 * @param request
 */
function migrateAuthType(request: Request) {
  const isAuthSet = request?.authentication && 'username' in request.authentication && request.authentication.username;
  // @ts-expect-error -- old model
  if (isAuthSet && !request.authentication.type) {
    // @ts-expect-error -- old model
    request.authentication.type = 'basic';
  }

  return request;
}
