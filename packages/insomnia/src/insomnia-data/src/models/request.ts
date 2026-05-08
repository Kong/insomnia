/**
 * Request Model Definition
 *
 * This module defines the Request model for Insomnia, including all authentication types,
 * request body types, and validation logic. It handles HTTP requests, WebSocket requests,
 * and other request types with comprehensive authentication support.
 *
 * Key responsibilities:
 * - Define request data structure and validation
 * - Support multiple authentication methods (OAuth, Basic, API Key, etc.)
 * - Handle different request body types (JSON, form data, raw text)
 * - Provide GraphQL operation type detection
 *
 */

import { OperationTypeNode } from 'graphql';

import type { OAuth1SignatureMethod } from '~/common/constants';
import { METHOD_GET } from '~/common/constants';
import { getOperationType } from '~/utils/graph-ql';

import type { BaseModel } from './base-types';
import { replaceIdsInFields } from './utils/replace-ids-in-fields';

export const name = 'Request';

export const type = 'Request';

export const prefix = 'req';

export const canDuplicate = true;

export const canSync = true;

/**
 * Basic Authentication configuration
 * Uses username and password with optional ISO-8859-1 encoding
 */
export interface AuthTypeBasic {
  type: 'basic';
  useISO88591?: boolean;
  disabled?: boolean;
  username?: string;
  password?: string;
}
/**
 * API Key Authentication configuration
 * Adds API key to headers or query parameters
 */
export interface AuthTypeAPIKey {
  type: 'apikey';
  disabled?: boolean;
  key?: string;
  value?: string;
  addTo?: string;
}

/**
 * OAuth 2.0 Authentication configuration
 * Supports all OAuth 2.0 grant types and flows
 */
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
  // Find all path parameters in the URL. Path parameters are defined as segments of the URL that start with a colon.
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
      urlPathParameters
        .filter(p => !savedPathParameters.map(p => p.name).includes(p))
        .map(p => ({ name: p, value: '' })),
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
  preRequestScript?: string;
  afterResponseScript?: string;
  parameters: RequestParameter[];
  pathParameters?: RequestPathParameter[];
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
  konnectRouteKey?: string | null;
  konnectManagedHeaderNames?: string[] | null;
}

export type Request = BaseModel & BaseRequest;

export const isRequest = (model: Pick<BaseModel, 'type'>): model is Request => model.type === type;

export const isRequestId = (id?: string | null) => id?.startsWith(`${prefix}_`);

export const isEventStreamRequest = (model: Pick<BaseModel, 'type'>) =>
  isRequest(model) && model.headers?.find(h => h.name === 'Accept')?.value === 'text/event-stream';
export const isGraphqlSubscriptionRequest = (model: Pick<BaseModel, 'type'>) =>
  isRequest(model) && getOperationType(model) === OperationTypeNode.SUBSCRIPTION;

export const optionalKeys = ['konnectRouteKey', 'konnectManagedHeaderNames'];

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
    // Settings
    settingStoreCookies: true,
    settingSendCookies: true,
    settingDisableRenderRequestBody: false,
    settingEncodeUrl: true,
    settingRebuildPath: true,
    settingFollowRedirects: 'global',
  };
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
    konnectRouteKey: null,
  };
}
