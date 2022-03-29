import { deconstructQueryStringToParams } from 'insomnia-url';

import {
  AUTH_ASAP,
  AUTH_AWS_IAM,
  AUTH_BASIC,
  AUTH_DIGEST,
  AUTH_HAWK,
  AUTH_NETRC,
  AUTH_NONE,
  AUTH_NTLM,
  AUTH_OAUTH_1,
  AUTH_OAUTH_2,
  CONTENT_TYPE_FILE,
  CONTENT_TYPE_FORM_DATA,
  CONTENT_TYPE_FORM_URLENCODED,
  CONTENT_TYPE_GRAPHQL,
  CONTENT_TYPE_JSON,
  CONTENT_TYPE_OTHER,
  getContentTypeFromHeaders,
  HAWK_ALGORITHM_SHA256,
  METHOD_GET,
  METHOD_POST,
} from '../common/constants';
import { database as db } from '../common/database';
import { getContentTypeHeader } from '../common/misc';
import { SIGNATURE_METHOD_HMAC_SHA1 } from '../network/o-auth-1/constants';
import { GRANT_TYPE_AUTHORIZATION_CODE } from '../network/o-auth-2/constants';
import type { BaseModel } from './index';

export const name = 'Request';

export const type = 'Request';

export const prefix = 'req';

export const canDuplicate = true;

export const canSync = true;

export type RequestAuthentication = Record<string, any>;

export interface RequestHeader {
  name: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface RequestParameter {
  name: string;
  value: string;
  disabled?: boolean;
  id?: string;
  fileName?: string;
}

export interface RequestBodyParameter {
  name: string;
  value: string;
  description?: string;
  disabled?: boolean;
  multiline?: string;
  id?: string;
  fileName?: string;
  type?: string;
}

export interface RequestBody {
  mimeType?: string | null;
  text?: string;
  fileName?: string;
  params?: RequestBodyParameter[];
}

export interface BaseRequest {
  url: string;
  name: string;
  description: string;
  method: string;
  body: RequestBody;
  parameters: RequestParameter[];
  headers: RequestHeader[];
  authentication: RequestAuthentication;
  metaSortKey: number;
  isPrivate: boolean;
  // Settings
  settingStoreCookies: boolean;
  settingSendCookies: boolean;
  settingDisableRenderRequestBody: boolean;
  settingEncodeUrl: boolean;
  settingRebuildPath: boolean;
  settingFollowRedirects: string;
}

export type Request = BaseModel & BaseRequest;

export const isRequest = (model: Pick<BaseModel, 'type'>): model is Request => (
  model.type === type
);

export function init(): BaseRequest {
  return {
    url: '',
    name: 'New Request',
    description: '',
    method: METHOD_GET,
    body: {},
    parameters: [],
    headers: [],
    authentication: {},
    metaSortKey: -1 * Date.now(),
    isPrivate: false,
    // Settings
    settingStoreCookies: true,
    settingSendCookies: true,
    settingDisableRenderRequestBody: false,
    settingEncodeUrl: true,
    settingRebuildPath: true,
    settingFollowRedirects: 'global',
  };
}

export function newAuth(type: string, oldAuth: RequestAuthentication = {}): RequestAuthentication {
  switch (type) {
    // No Auth
    case AUTH_NONE:
      return {};

    // HTTP Basic Authentication
    case AUTH_BASIC:
      return {
        type,
        useISO88591: oldAuth.useISO88591 || false,
        disabled: oldAuth.disabled || false,
        username: oldAuth.username || '',
        password: oldAuth.password || '',
      };

    case AUTH_DIGEST:
    case AUTH_NTLM:
      return {
        type,
        disabled: oldAuth.disabled || false,
        username: oldAuth.username || '',
        password: oldAuth.password || '',
      };

    case AUTH_OAUTH_1:
      return {
        type,
        disabled: false,
        signatureMethod: SIGNATURE_METHOD_HMAC_SHA1,
        consumerKey: '',
        consumerSecret: '',
        tokenKey: '',
        tokenSecret: '',
        privateKey: '',
        version: '1.0',
        nonce: '',
        timestamp: '',
        callback: '',
      };

    // OAuth 2.0
    case AUTH_OAUTH_2:
      return {
        type,
        grantType: GRANT_TYPE_AUTHORIZATION_CODE,
      };

    // Aws IAM
    case AUTH_AWS_IAM:
      return {
        type,
        disabled: oldAuth.disabled || false,
        accessKeyId: oldAuth.accessKeyId || '',
        secretAccessKey: oldAuth.secretAccessKey || '',
        sessionToken: oldAuth.sessionToken || '',
      };

    // Hawk
    case AUTH_HAWK:
      return {
        type,
        algorithm: HAWK_ALGORITHM_SHA256,
      };

    // Atlassian ASAP
    case AUTH_ASAP:
      return {
        type,
        issuer: '',
        subject: '',
        audience: '',
        additionalClaims: '',
        keyId: '',
        privateKey: '',
      };

    // Types needing no defaults
    case AUTH_NETRC:
    default:
      return {
        type,
      };
  }
}

export function newBodyNone(): RequestBody {
  return {};
}

export function newBodyRaw(rawBody: string, contentType?: string): RequestBody {
  if (typeof contentType !== 'string') {
    return {
      text: rawBody,
    };
  }

  const mimeType = contentType.split(';')[0];
  return {
    mimeType,
    text: rawBody,
  };
}

export function newBodyGraphQL(rawBody: string): RequestBody {
  try {
    // Only strip the newlines if rawBody is a parsable JSON
    JSON.parse(rawBody);
    return {
      mimeType: CONTENT_TYPE_GRAPHQL,
      text: rawBody.replace(/\\\\n/g, ''),
    };
  } catch (e) {
    if (e instanceof SyntaxError) {
      return {
        mimeType: CONTENT_TYPE_GRAPHQL,
        text: rawBody,
      };
    } else {
      throw e;
    }
  }
}

export function newBodyFormUrlEncoded(parameters: RequestBodyParameter[] | null): RequestBody {
  return {
    mimeType: CONTENT_TYPE_FORM_URLENCODED,
    params: parameters || [],
  };
}

export function newBodyFile(path: string): RequestBody {
  return {
    mimeType: CONTENT_TYPE_FILE,
    fileName: path,
  };
}

export function newBodyForm(parameters: RequestBodyParameter[]): RequestBody {
  return {
    mimeType: CONTENT_TYPE_FORM_DATA,
    params: parameters || [],
  };
}

export function migrate(doc: Request): Request {
  doc = migrateBody(doc);
  doc = migrateWeirdUrls(doc);
  doc = migrateAuthType(doc);
  return doc;
}

export function create(patch: Partial<Request> = {}) {
  if (!patch.parentId) {
    throw new Error(`New Requests missing \`parentId\`: ${JSON.stringify(patch)}`);
  }

  return db.docCreate<Request>(type, patch);
}

export function getById(id: string): Promise<Request | null> {
  return db.get(type, id);
}

export function findByParentId(parentId: string) {
  return db.find<Request>(type, { parentId: parentId });
}

export function update(request: Request, patch: Partial<Request>) {
  return db.docUpdate<Request>(request, patch);
}

export function updateMimeType(
  request: Request,
  mimeType: string,
  doCreate = false,
  savedBody: RequestBody = {},
) {
  let headers = request.headers ? [...request.headers] : [];
  const contentTypeHeader = getContentTypeHeader(headers);
  // GraphQL uses JSON content-type
  const contentTypeHeaderValue = mimeType === CONTENT_TYPE_GRAPHQL ? CONTENT_TYPE_JSON : mimeType;

  // GraphQL must be POST
  if (mimeType === CONTENT_TYPE_GRAPHQL) {
    request.method = METHOD_POST;
  }

  // Check if we are converting to/from variants of XML or JSON
  let leaveContentTypeAlone = false;

  if (contentTypeHeader && mimeType) {
    const current = contentTypeHeader.value;

    if (current.includes('xml') && mimeType.includes('xml')) {
      leaveContentTypeAlone = true;
    } else if (current.includes('json') && mimeType.includes('json')) {
      leaveContentTypeAlone = true;
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // 1. Update Content-Type header //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  const hasBody = typeof mimeType === 'string';

  if (!hasBody) {
    headers = headers.filter(h => h !== contentTypeHeader);
  } else if (mimeType === CONTENT_TYPE_OTHER) {
    // Leave headers alone
  } else if (mimeType && contentTypeHeader && !leaveContentTypeAlone) {
    contentTypeHeader.value = contentTypeHeaderValue;
  } else if (mimeType && !contentTypeHeader) {
    headers.push({
      name: 'Content-Type',
      value: contentTypeHeaderValue,
    });
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // 2. Make a new request body //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  let body;
  const oldBody = Object.keys(savedBody).length === 0 ? request.body : savedBody;

  if (mimeType === CONTENT_TYPE_FORM_URLENCODED) {
    // Urlencoded
    body = oldBody.params
      ? newBodyFormUrlEncoded(oldBody.params)
      // @ts-expect-error -- TSCONVERSION
      : newBodyFormUrlEncoded(deconstructQueryStringToParams(oldBody.text));
  } else if (mimeType === CONTENT_TYPE_FORM_DATA) {
    // Form Data
    body = oldBody.params
      ? newBodyForm(oldBody.params)
      // @ts-expect-error -- TSCONVERSION
      : newBodyForm(deconstructQueryStringToParams(oldBody.text));
  } else if (mimeType === CONTENT_TYPE_FILE) {
    // File
    body = newBodyFile('');
  } else if (mimeType === CONTENT_TYPE_GRAPHQL) {
    if (contentTypeHeader) {
      contentTypeHeader.value = CONTENT_TYPE_JSON;
    }

    body = newBodyGraphQL(oldBody.text || '');
  } else if (typeof mimeType !== 'string') {
    // No body
    body = newBodyNone();
  } else {
    // Raw Content-Type (ex: application/json)
    body = newBodyRaw(oldBody.text || '', mimeType);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~ //
  // 2. create/update request //
  // ~~~~~~~~~~~~~~~~~~~~~~~~ //
  if (doCreate) {
    const newRequest: Request = Object.assign({}, request, {
      headers,
      body,
    });
    return create(newRequest);
  } else {
    return update(request, {
      headers,
      body,
    });
  }
}

export async function duplicate(request: Request, patch: Partial<Request> = {}) {
  // Only set name and "(Copy)" if the patch does
  // not define it and the request itself has a name.
  // Otherwise leave it blank so the request URL can
  // fill it in automatically.
  if (!patch.name && request.name) {
    patch.name = `${request.name} (Copy)`;
  }

  // Get sort key of next request
  const q = {
    metaSortKey: {
      $gt: request.metaSortKey,
    },
  };

  // @ts-expect-error -- TSCONVERSION appears to be a genuine error
  const [nextRequest] = await db.find<Request>(type, q, {
    metaSortKey: 1,
  });

  const nextSortKey = nextRequest ? nextRequest.metaSortKey : request.metaSortKey + 100;
  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - request.metaSortKey) / 2;
  const metaSortKey = request.metaSortKey + sortKeyIncrement;
  return db.duplicate<Request>(request, {
    name,
    metaSortKey,
    ...patch,
  });
}

export function remove(request: Request) {
  return db.remove(request);
}

export async function all() {
  return db.all<Request>(type);
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
    const body = typeof request.body === 'string' ? request.body : '';
    request.body = newBodyFormUrlEncoded(deconstructQueryStringToParams(body, false));
  } else if (!request.body && !contentType) {
    request.body = {};
  } else {
    const body: string = typeof request.body === 'string' ? request.body : '';
    request.body = newBodyRaw(body, contentType);
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
  const isAuthSet = request.authentication && request.authentication.username;

  if (isAuthSet && !request.authentication.type) {
    request.authentication.type = AUTH_BASIC;
  }

  return request;
}
