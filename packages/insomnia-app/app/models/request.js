// @flow
import type { BaseModel } from './index';
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
  METHOD_POST
} from '../common/constants';
import * as db from '../common/database';
import { getContentTypeHeader } from '../common/misc';
import {
  buildQueryStringFromParams,
  deconstructQueryStringToParams
} from 'insomnia-url';
import { GRANT_TYPE_AUTHORIZATION_CODE } from '../network/o-auth-2/constants';
import { SIGNATURE_METHOD_HMAC_SHA1 } from '../network/o-auth-1/constants';

export const name = 'Request';
export const type = 'Request';
export const prefix = 'req';
export const canDuplicate = true;

export type RequestAuthentication = Object;

export type RequestHeader = {
  name: string,
  value: string,
  disabled?: boolean
};

export type RequestParameter = {
  name: string,
  value: string,
  disabled?: boolean,
  id?: string,
  fileName?: string
};

export type RequestBodyParameter = {
  name: string,
  value: string,
  disabled?: boolean,
  multiline?: string,
  id?: string,
  fileName?: string,
  type?: string
};

export type RequestBody = {
  mimeType?: string | null,
  text?: string,
  fileName?: string,
  params?: Array<RequestBodyParameter>
};

type BaseRequest = {
  url: string,
  name: string,
  description: string,
  method: string,
  body: RequestBody,
  parameters: Array<RequestParameter>,
  headers: Array<RequestHeader>,
  authentication: RequestAuthentication,
  metaSortKey: number,
  isPrivate: boolean,

  // Settings
  settingStoreCookies: boolean,
  settingSendCookies: boolean,
  settingDisableRenderRequestBody: boolean,
  settingEncodeUrl: boolean,
  settingRebuildPath: boolean,
  settingMaxTimelineDataSize: number
};

export type Request = BaseModel & BaseRequest;

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
    settingMaxTimelineDataSize: 1000
  };
}

export function newAuth(
  type: string,
  oldAuth: RequestAuthentication = {}
): RequestAuthentication {
  switch (type) {
    // No Auth
    case AUTH_NONE:
      return {};

    // HTTP Basic Authentication
    case AUTH_BASIC:
    case AUTH_DIGEST:
    case AUTH_NTLM:
      return {
        type,
        disabled: oldAuth.disabled || false,
        username: oldAuth.username || '',
        password: oldAuth.password || ''
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
        callback: ''
      };

    // OAuth 2.0
    case AUTH_OAUTH_2:
      return {
        type,
        grantType: GRANT_TYPE_AUTHORIZATION_CODE
      };

    // Aws IAM
    case AUTH_AWS_IAM:
      return {
        type,
        disabled: oldAuth.disabled || false,
        accessKeyId: oldAuth.accessKeyId || '',
        secretAccessKey: oldAuth.secretAccessKey || '',
        sessionToken: oldAuth.sessionToken || ''
      };

    // Hawk
    case AUTH_HAWK:
      return {
        type,
        algorithm: HAWK_ALGORITHM_SHA256
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
        privateKey: ''
      };

    // Types needing no defaults
    case AUTH_NETRC:
    default:
      return { type };
  }
}

export function newBodyNone(): RequestBody {
  return {};
}

export function newBodyRaw(rawBody: string, contentType?: string): RequestBody {
  if (typeof contentType !== 'string') {
    return { text: rawBody };
  }

  const mimeType = contentType.split(';')[0];
  return { mimeType, text: rawBody };
}

export function newBodyFormUrlEncoded(
  parameters: Array<RequestBodyParameter> | null
): RequestBody {
  return {
    mimeType: CONTENT_TYPE_FORM_URLENCODED,
    params: parameters || []
  };
}

export function newBodyFile(path: string): RequestBody {
  return {
    mimeType: CONTENT_TYPE_FILE,
    fileName: path
  };
}

export function newBodyForm(
  parameters: Array<RequestBodyParameter>
): RequestBody {
  return {
    mimeType: CONTENT_TYPE_FORM_DATA,
    params: parameters || []
  };
}

export function migrate(doc: Request): Request {
  doc = migrateBody(doc);
  doc = migrateWeirdUrls(doc);
  doc = migrateAuthType(doc);
  return doc;
}

export function create(patch: Object = {}): Promise<Request> {
  if (!patch.parentId) {
    throw new Error(
      `New Requests missing \`parentId\`: ${JSON.stringify(patch)}`
    );
  }

  return db.docCreate(type, patch);
}

export function getById(id: string): Promise<Request | null> {
  return db.get(type, id);
}

export function findByParentId(parentId: string): Promise<Array<Request>> {
  return db.find(type, { parentId: parentId });
}

export function update(request: Request, patch: Object): Promise<Request> {
  return db.docUpdate(request, patch);
}

export function updateMimeType(
  request: Request,
  mimeType: string,
  doCreate: boolean = false,
  savedBody: RequestBody = {}
): Promise<Request> {
  let headers = request.headers ? [...request.headers] : [];
  const contentTypeHeader = getContentTypeHeader(headers);

  // GraphQL uses JSON content-type
  const contentTypeHeaderValue =
    mimeType === CONTENT_TYPE_GRAPHQL ? CONTENT_TYPE_JSON : mimeType;

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
  if (!hasBody || mimeType === CONTENT_TYPE_OTHER) {
    // Leave headers alone
  } else if (mimeType && contentTypeHeader && !leaveContentTypeAlone) {
    contentTypeHeader.value = contentTypeHeaderValue;
  } else if (mimeType && !contentTypeHeader) {
    headers.push({ name: 'Content-Type', value: contentTypeHeaderValue });
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // 2. Make a new request body //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  let body;

  const oldBody =
    Object.keys(savedBody).length === 0 ? request.body : savedBody;

  if (mimeType === CONTENT_TYPE_FORM_URLENCODED) {
    // Urlencoded
    body = oldBody.params
      ? newBodyFormUrlEncoded(oldBody.params)
      : newBodyFormUrlEncoded(deconstructQueryStringToParams(oldBody.text));
  } else if (mimeType === CONTENT_TYPE_FORM_DATA) {
    // Form Data
    body = oldBody.params
      ? newBodyForm(oldBody.params)
      : newBodyForm(deconstructQueryStringToParams(oldBody.text));
  } else if (mimeType === CONTENT_TYPE_FILE) {
    // File
    body = newBodyFile('');
  } else if (mimeType === CONTENT_TYPE_GRAPHQL) {
    if (contentTypeHeader) {
      contentTypeHeader.value = CONTENT_TYPE_JSON;
    }
    body = newBodyRaw(oldBody.text || '', CONTENT_TYPE_GRAPHQL);
  } else if (typeof mimeType !== 'string') {
    // No body
    body = newBodyNone();
  } else {
    // Raw Content-Type (ex: application/json)
    body = oldBody.params
      ? newBodyRaw(buildQueryStringFromParams(oldBody.params, false), mimeType)
      : newBodyRaw(oldBody.text || '', mimeType);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~ //
  // 2. create/update request //
  // ~~~~~~~~~~~~~~~~~~~~~~~~ //

  if (doCreate) {
    const newRequest: Request = Object.assign({}, request, { headers, body });
    return create(newRequest);
  } else {
    return update(request, { headers, body });
  }
}

export async function duplicate(request: Request): Promise<Request> {
  const name = `${request.name} (Copy)`;

  // Get sort key of next request
  const q = { metaSortKey: { $gt: request.metaSortKey } };
  const [nextRequest] = await db.find(type, q, { metaSortKey: 1 });
  const nextSortKey = nextRequest
    ? nextRequest.metaSortKey
    : request.metaSortKey + 100;

  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - request.metaSortKey) / 2;
  const metaSortKey = request.metaSortKey + sortKeyIncrement;

  return db.duplicate(request, { name, metaSortKey });
}

export function remove(request: Request): Promise<void> {
  return db.remove(request);
}

export function all() {
  return db.all(type);
}

// ~~~~~~~~~~ //
// Migrations //
// ~~~~~~~~~~ //

/**
 * Migrate old body (string) to new body (object)
 * @param request
 * @returns {*}
 */
function migrateBody(request: Request): Request {
  if (request.body && typeof request.body === 'object') {
    return request;
  }

  // Second, convert all existing urlencoded bodies to new format
  const contentType = getContentTypeFromHeaders(request.headers) || '';
  const wasFormUrlEncoded = !!contentType.match(
    /^application\/x-www-form-urlencoded/i
  );

  if (wasFormUrlEncoded) {
    // Convert old-style form-encoded request bodies to new style
    const body = typeof request.body === 'string' ? request.body : '';
    request.body = newBodyFormUrlEncoded(
      deconstructQueryStringToParams(body, false)
    );
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
 * @returns {*}
 */
function migrateWeirdUrls(request: Request): Request {
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
 * @returns {*}
 */
function migrateAuthType(request: Request): Request {
  const isAuthSet = request.authentication && request.authentication.username;

  if (isAuthSet && !request.authentication.type) {
    request.authentication.type = AUTH_BASIC;
  }

  return request;
}
