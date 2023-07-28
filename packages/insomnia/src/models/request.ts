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
  CONTENT_TYPE_FORM_URLENCODED,
  getContentTypeFromHeaders,
  HAWK_ALGORITHM_SHA256,
  METHOD_GET,
} from '../common/constants';
import { database as db } from '../common/database';
import { SIGNATURE_METHOD_HMAC_SHA1 } from '../network/o-auth-1/constants';
import { GRANT_TYPE_AUTHORIZATION_CODE } from '../network/o-auth-2/constants';
import { deconstructQueryStringToParams } from '../utils/url/querystring';
import type { BaseModel } from './index';

export const name = 'Request';

export const type = 'Request';

export const prefix = 'req';

export const canDuplicate = true;

export const canSync = true;

export type RequestAuthentication = Record<string, any>;
export type OAuth2ResponseType = 'code' | 'id_token' | 'id_token token' | 'none' | 'token';
export interface AuthTypeOAuth2 {
  type: 'oauth2';
  grantType: 'authorization_code' | 'client_credentials' | 'password' | 'implicit' | 'refresh_token';
  accessTokenUrl?: string;
  authorizationUrl?: string;
  clientId?: string;
  clientSecret?: string;
  audience?: string;
  scope?: string;
  resource?: string;
  username?: string;
  password?: string;
  redirectUrl?: string;
  credentialsInBody?: boolean;
  state?: string;
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenPrefix?: string;
  usePkce?: boolean;
  pkceMethod?: string;
  responseType?: OAuth2ResponseType;
  origin?: string;
}
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
  settingFollowRedirects: 'global' | 'on' | 'off';
}

export type Request = BaseModel & BaseRequest;

export const isRequest = (model: Pick<BaseModel, 'type'>): model is Request => (
  model.type === type
);

export const isRequestId = (id: string | null) => (
  id?.startsWith(`${prefix}_`)
);

export const isEventStreamRequest = (model: Pick<BaseModel, 'type'>) => (
  isRequest(model) && model.headers?.find(h => h.name === 'Accept')?.value === 'text/event-stream'
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
    request.body = {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: deconstructQueryStringToParams(typeof request.body === 'string' ? request.body : '', false),
    };
  } else if (!request.body && !contentType) {
    request.body = {};
  } else {
    const rawBody: string = typeof request.body === 'string' ? request.body : '';
    request.body = typeof contentType !== 'string' ? {
      text: rawBody,
    } : {
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
  const isAuthSet = request.authentication && request.authentication.username;

  if (isAuthSet && !request.authentication.type) {
    request.authentication.type = AUTH_BASIC;
  }

  return request;
}
