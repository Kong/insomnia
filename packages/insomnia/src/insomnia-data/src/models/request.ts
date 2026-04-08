import { OperationTypeNode } from 'graphql';

import { CONTENT_TYPE_FORM_URLENCODED, getContentTypeFromHeaders, METHOD_GET } from '~/common/constants';
import { replaceIdsInFields } from '~/models/helpers/replace-ids-in-fields';
import type { BaseModel } from '~/models/types';
import type { OAuth1SignatureMethod } from '~/network/o-auth-1/constants';
import { getOperationType } from '~/utils/graph-ql';
import { deconstructQueryStringToParams } from '~/utils/url/querystring';

export const name = 'Request';
export const type = 'Request';
export const prefix = 'req';
export const canDuplicate = true;
export const canSync = true;

export interface AuthTypeBasic {
  type: 'basic';
  useISO88591?: boolean;
  disabled?: boolean;
  username?: string;
  password?: string;
}

export interface AuthTypeAPIKey {
  type: 'apikey';
  disabled?: boolean;
  key?: string;
  value?: string;
  addTo?: string;
}

export interface AuthTypeOAuth2 {
  type: 'oauth2';
  disabled?: boolean;
  grantType: 'authorization_code' | 'client_credentials' | 'password' | 'implicit' | 'refresh_token' | 'mcp_auth_flow';
  accessTokenUrl?: string;
  authorizationUrl?: string;
  clientId?: string;
  clientSecret?: string;
  clientIdIssuedAt?: number;
  clientSecretExpiresAt?: number;
  audience?: string;
  scope?: string;
  resource?: string;
  username?: string;
  password?: string;
  redirectUrl?: string;
  useDefaultBrowser?: boolean;
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
  type: 'hawk';
  disabled?: boolean;
  algorithm: 'sha1' | 'sha256';
  id: string;
  key: string;
  ext?: string;
  validatePayload?: boolean;
}

export interface AuthTypeOAuth1 {
  type: 'oauth1';
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
  type: 'digest';
  disabled?: boolean;
  username?: string;
  password?: string;
}

export interface AuthTypeNTLM {
  type: 'ntlm';
  disabled?: boolean;
  username?: string;
  password?: string;
}

export interface AuthTypeBearer {
  type: 'bearer';
  disabled?: boolean;
  token?: string;
  prefix?: string;
}

export interface AuthTypeAwsIam {
  type: 'iam';
  disabled?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region?: string;
  service?: string;
}

export interface AuthTypeNetrc {
  type: 'netrc';
  disabled?: boolean;
}

export interface AuthTypeAsap {
  type: 'asap';
  disabled?: boolean;
  issuer: string;
  subject?: string;
  audience: string;
  additionalClaims?: string;
  keyId: string;
  privateKey: string;
}

export interface AuthTypeNone {
  type: 'none';
  disabled?: boolean;
}

export interface AuthTypeSingleToken {
  type: 'singleToken';
  token?: string;
  disabled?: boolean;
}

export type RequestAuthentication =
  | AuthTypeOAuth2
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
  | AuthTypeNTLM
  | AuthTypeSingleToken;

export type OAuth2ResponseType = 'code' | 'id_token' | 'id_token token' | 'none' | 'token';

export interface RequestHeader {
  name: string;
  id?: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface RequestParameter {
  name: string;
  value: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  type?: string;
  multiline?: boolean;
}

export interface RequestBodyParameter {
  name: string;
  value?: string;
  description?: string;
  disabled?: boolean;
  multiline?: boolean;
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
  const urlPathParameters =
    url
      .match(PATH_PARAMETER_REGEX)
      ?.map(String)
      .map(match => match.replace('/:', '')) || [];
  const uniqueUrlPathParameters = [...new Set(urlPathParameters)];

  return uniqueUrlPathParameters;
};

export const getCombinedPathParametersFromUrl = (
  url: string,
  pathParameters: RequestPathParameter[],
): RequestPathParameter[] => {
  const urlPathParameters = getPathParametersFromUrl(url);
  let savedPathParameters: RequestPathParameter[] = [];

  if (pathParameters) {
    savedPathParameters = pathParameters.filter(parameter => urlPathParameters.includes(parameter.name));
  }

  let unsavedUrlPathParameters = new Set<RequestPathParameter>();

  if (urlPathParameters) {
    unsavedUrlPathParameters = new Set(
      urlPathParameters
        .filter(parameter => !savedPathParameters.map(saved => saved.name).includes(parameter))
        .map(parameter => ({ name: parameter, value: '' })),
    );
  }

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
  preRequestScript?: string;
  afterResponseScript?: string;
  parameters: RequestParameter[];
  pathParameters?: RequestPathParameter[];
  headers: RequestHeader[];
  authentication: RequestAuthentication | {};
  metaSortKey: number;
  isPrivate: boolean;
  settingStoreCookies: boolean;
  settingSendCookies: boolean;
  settingDisableRenderRequestBody: boolean;
  settingEncodeUrl: boolean;
  settingRebuildPath: boolean;
  settingFollowRedirects: 'global' | 'on' | 'off';
}

export type Request = BaseModel & BaseRequest;

export const isRequest = (model: Pick<BaseModel, 'type'>): model is Request => model.type === type;
export const isRequestId = (id?: string | null) => id?.startsWith(`${prefix}_`);
export const isEventStreamRequest = (model: Pick<BaseModel, 'type'>) =>
  isRequest(model) && model.headers?.find(header => header.name === 'Accept')?.value === 'text/event-stream';
export const isGraphqlSubscriptionRequest = (model: Pick<BaseModel, 'type'>) =>
  isRequest(model) && getOperationType(model) === OperationTypeNode.SUBSCRIPTION;

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
    preRequestScript: undefined,
    metaSortKey: -1 * Date.now(),
    isPrivate: false,
    pathParameters: undefined,
    afterResponseScript: undefined,
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
  } catch (error) {
    console.log('[db] Error during request migration', error);
    throw error;
  }
}

function migrateBody(request: Request) {
  if (request.body && typeof request.body === 'object') {
    return request;
  }

  const contentType = getContentTypeFromHeaders(request.headers) || '';
  const wasFormUrlEncoded = !!contentType.match(/^application\/x-www-form-urlencoded/i);

  if (wasFormUrlEncoded) {
    request.body = {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: deconstructQueryStringToParams(typeof request.body === 'string' ? request.body : '', false),
    };
  } else if (!request.body && !contentType) {
    request.body = {};
  } else {
    const rawBody = typeof request.body === 'string' ? request.body : '';
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

function migrateWeirdUrls(request: Request) {
  if (typeof request.url !== 'string') {
    request.url = '';
  }

  return request;
}

function migrateAuthType(request: Request) {
  const isAuthSet = request?.authentication && 'username' in request.authentication && request.authentication.username;
  // @ts-expect-error old model migration
  if (isAuthSet && !request.authentication.type) {
    // @ts-expect-error old model migration
    request.authentication.type = 'basic';
  }

  return request;
}

export function rewriteReferences(request: Request, idMapping: Map<string, string>): Request {
  return {
    ...request,
    ...replaceIdsInFields(
      request,
      [
        'url',
        'body',
        'parameters',
        'pathParameters',
        'headers',
        'authentication',
        'preRequestScript',
        'afterResponseScript',
      ],
      idMapping,
    ),
  };
}
