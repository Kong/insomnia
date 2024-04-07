import {
  AUTH_API_KEY,
  AUTH_ASAP,
  AUTH_AWS_IAM,
  AUTH_BASIC,
  AUTH_BEARER,
  AUTH_DIGEST,
  AUTH_HAWK,
  AUTH_NETRC,
  AUTH_NONE,
  AUTH_NTLM,
  AUTH_OAUTH_1,
  CONTENT_TYPE_FORM_URLENCODED,
  getContentTypeFromHeaders,
  HAWK_ALGORITHM_SHA1,
  HAWK_ALGORITHM_SHA256,
  METHOD_GET,
} from '../common/constants';
import { database as db } from '../common/database';
import type { OAuth1SignatureMethod } from '../network/o-auth-1/constants';
import { deconstructQueryStringToParams } from '../utils/url/querystring';
import type { BaseModel } from './index';

export const name = 'Request';

export const type = 'Request';

export const prefix = 'req';

export const canDuplicate = true;

export const canSync = true;
export type AuthTypes = 'none'
  | 'apikey'
  | 'oauth2'
  | 'oauth1'
  | 'basic'
  | 'digest'
  | 'bearer'
  | 'ntlm'
  | 'hawk'
  | 'iam'
  | 'netrc'
  | 'asap';

export interface AuthTypeBasic {
  type: typeof AUTH_BASIC;
  useISO88591?: boolean;
  disabled?: boolean;
  username?: string;
  password?: string;
}
export interface AuthTypeAPIKey {
  type: typeof AUTH_API_KEY;
  disabled?: boolean;
  key?: string;
  value?: string;
  addTo?: string;
}
export interface AuthTypeOAuth2 {
  type: 'oauth2';
  disabled?: boolean;
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
export interface AuthTypeHawk {
  type: typeof AUTH_HAWK;
  disabled?: boolean;
  algorithm: typeof HAWK_ALGORITHM_SHA256 | typeof HAWK_ALGORITHM_SHA1;
  id: string;
  key: string;
  ext?: string;
  validatePayload?: boolean;
}
export interface AuthTypeOAuth1 {
  type: typeof AUTH_OAUTH_1;
  disabled?: boolean;
  signatureMethod?: OAuth1SignatureMethod;
  consumerKey?: string;
  consumerSecret?: string;
  tokenKey?: string;
  tokenSecret?: string;
  privateKey?: string;
  version?: string;
  nonce?: string;
  timestamp?: string;
  callback?: string;
  realm?: string;
  verifier?: string;
  includeBodyHash?: boolean;
}
export interface AuthTypeDigest {
  type: typeof AUTH_DIGEST;
  disabled?: boolean;
  username?: string;
  password?: string;
}
export interface AuthTypeNTLM {
  type: typeof AUTH_NTLM;
  disabled?: boolean;
  username?: string;
  password?: string;
}
export interface AuthTypeBearer {
  type: typeof AUTH_BEARER;
  disabled?: boolean;
  token?: string;
  prefix?: string;
}
export interface AuthTypeAwsIam {
  type: typeof AUTH_AWS_IAM;
  disabled?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region?: string;
  service?: string;
}
export interface AuthTypeNetrc {
  type: typeof AUTH_NETRC;
  disabled?: boolean;
}
export interface AuthTypeAsap {
  type: typeof AUTH_ASAP;
  disabled?: boolean;
  issuer: string;
  subject?: string;
  audience: string;
  additionalClaims?: string;
  keyId: string;
  privateKey: string;
}
export interface AuthTypeNone {
  type: typeof AUTH_NONE;
  disabled?: boolean;
}
export type RequestAuthentication = AuthTypeOAuth2
  | AuthTypeBasic
  | AuthTypeBearer
  | AuthTypeDigest
  | AuthTypeHawk
  | AuthTypeOAuth1
  | AuthTypeAwsIam
  | AuthTypeNetrc
  | AuthTypeAsap
  | AuthTypeNone
  | AuthTypeAPIKey
  | AuthTypeNTLM;

export type OAuth2ResponseType = 'code' | 'id_token' | 'id_token token' | 'none' | 'token';

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

export interface RequestPathParameter {
  name: string;
  value: string;
}

export const PATH_PARAMETER_REGEX = /\/:[^/?#:]+/g;

export const getPathParametersFromUrl = (url: string): string[] => {
  // Find all path parameters in the URL. Path parameters are defined as segments of the URL that start with a colon.
  const urlPathParameters = url.match(PATH_PARAMETER_REGEX)?.map(String).map(match => match.replace('\/:', '')) || [];
  const uniqueUrlPathParameters = [...new Set(urlPathParameters)];

  return uniqueUrlPathParameters;
};

export const getCombinedPathParametersFromUrl = (url: string, pathParameters: RequestPathParameter[]): RequestPathParameter[] => {
  // Extract path parameters from the URL
  const urlPathParameters = getPathParametersFromUrl(url);

  // Initialize an empty array for saved path parameters
  let savedPathParameters: RequestPathParameter[] = [];

  // Check if there are any path parameters in the active request
  if (pathParameters) {
    // Filter out the saved path parameters
    savedPathParameters = pathParameters.filter(p => urlPathParameters.includes(p.name));
  }

  // Initialize an empty set for unsaved URL path parameters
  let unsavedUrlPathParameters = new Set<RequestPathParameter>();

  // Check if there are any path parameters in the URL
  if (urlPathParameters) {
    // Filter out the unsaved URL path parameters
    unsavedUrlPathParameters = new Set(
      urlPathParameters.filter(p => !savedPathParameters.map(p => p.name).includes(p))
        .map(p => ({ name: p, value: '' }))
    );
  }

  // Combine the saved and unsaved path parameters
  return [...savedPathParameters, ...unsavedUrlPathParameters];
};

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
  preRequestScript: string;
  parameters: RequestParameter[];
  pathParameters: RequestPathParameter[];
  headers: RequestHeader[];
  authentication: RequestAuthentication | {};
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
    preRequestScript: '',
    parameters: [],
    headers: [],
    authentication: {},
    metaSortKey: -1 * Date.now(),
    isPrivate: false,
    pathParameters: [],
    // Settings
    settingStoreCookies: true,
    settingSendCookies: true,
    settingDisableRenderRequestBody: false,
    settingEncodeUrl: true,
    settingRebuildPath: true,
    settingFollowRedirects: 'global',
  };
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

export function getByParentId(parentId: string) {
  return db.getWhere<Request>(type, { parentId: parentId });
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
  const isAuthSet = request?.authentication && 'username' in request.authentication && request.authentication.username;
  // @ts-expect-error -- old model
  if (isAuthSet && !request.authentication.type) {
    // @ts-expect-error -- old model
    request.authentication.type = AUTH_BASIC;
  }

  return request;
}
