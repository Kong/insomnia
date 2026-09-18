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

import { getOperationAST, OperationTypeNode, parse } from 'graphql';
import {
  CONTENT_TYPE_GRAPHQL,
  METHOD_GET,
  SIGNATURE_METHOD_HMAC_SHA1,
  SIGNATURE_METHOD_HMAC_SHA256,
  SIGNATURE_METHOD_PLAINTEXT,
  SIGNATURE_METHOD_RSA_SHA1,
} from 'insomnia-data/common';
import { z } from 'zod/v4';

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

export const AuthTypeBasicSchema = z.object({
  type: z.literal('basic'),
  useISO88591: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  disabled: z.boolean().optional(),
});
export type AuthTypeBasic = z.infer<typeof AuthTypeBasicSchema>;
/**
 * API Key Authentication configuration
 * Adds API key to headers or query parameters
 */
export const AuthTypeAPIKeySchema = z.object({
  type: z.literal('apikey'),
  key: z.string().optional(),
  value: z.string().optional(),
  disabled: z.boolean().optional(),
  addTo: z.string().optional(),
});
export type AuthTypeAPIKey = z.infer<typeof AuthTypeAPIKeySchema>;

/**
 * OAuth 2.0 Authentication configuration
 * Supports all OAuth 2.0 grant types and flows
 */
export const OAuth2GrantTypeSchema = z.enum([
  'authorization_code',
  'client_credentials',
  'password',
  'implicit',
  'refresh_token',
  'mcp_auth_flow',
]);
export const OAuth2ResponseTypeSchema = z.enum(['code', 'id_token', 'id_token token', 'none', 'token']);
export type OAuth2ResponseType = z.infer<typeof OAuth2ResponseTypeSchema>;
export const AuthTypeOAuth2Schema = z.object({
  type: z.literal('oauth2'),
  disabled: z.boolean().optional(),
  grantType: OAuth2GrantTypeSchema,
  accessTokenUrl: z.string().optional(),
  authorizationUrl: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  clientIdIssuedAt: z.number().optional(),
  clientSecretExpiresAt: z.number().optional(),
  audience: z.string().optional(),
  scope: z.string().optional(),
  resource: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  redirectUrl: z.string().optional(),
  useDefaultBrowser: z.boolean().optional(),
  credentialsInBody: z.boolean().optional(),
  state: z.string().optional(),
  code: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenPrefix: z.string().optional(),
  usePkce: z.boolean().optional(),
  pkceMethod: z.string().optional(),
  responseType: OAuth2ResponseTypeSchema.optional(),
  launchBrowserManually: z.boolean().optional(),
  origin: z.string().optional(),
});
export type AuthTypeOAuth2 = z.infer<typeof AuthTypeOAuth2Schema>;

export const AuthTypeHawkSchema = z.object({
  type: z.literal('hawk'),
  disabled: z.boolean().optional(),
  algorithm: z.enum(['sha1', 'sha256']),
  id: z.string(),
  key: z.string(),
  ext: z.string().optional(),
  validatePayload: z.boolean().optional(),
});
export type AuthTypeHawk = z.infer<typeof AuthTypeHawkSchema>;

export const AuthTypeOAuth1Schema = z.object({
  type: z.literal('oauth1'),
  disabled: z.boolean().optional(),
  signatureMethod: z
    .enum([
      SIGNATURE_METHOD_HMAC_SHA1,
      SIGNATURE_METHOD_HMAC_SHA256,
      SIGNATURE_METHOD_RSA_SHA1,
      SIGNATURE_METHOD_PLAINTEXT,
    ])
    .optional(),
  consumerKey: z.string().optional(),
  consumerSecret: z.string().optional(),
  tokenKey: z.string().optional(),
  tokenSecret: z.string().optional(),
  privateKey: z.string().optional(),
  version: z.string().optional(),
  nonce: z.string().optional(),
  timestamp: z.string().optional(),
  callback: z.string().optional(),
  realm: z.string().optional(),
  verifier: z.string().optional(),
  includeBodyHash: z.boolean().optional(),
});
export type AuthTypeOAuth1 = z.infer<typeof AuthTypeOAuth1Schema>;

export const AuthTypeDigestSchema = z.object({
  type: z.literal('digest'),
  disabled: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});
export type AuthTypeDigest = z.infer<typeof AuthTypeDigestSchema>;

export const AuthTypeNTLMSchema = z.object({
  type: z.literal('ntlm'),
  disabled: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});
export type AuthTypeNTLM = z.infer<typeof AuthTypeNTLMSchema>;

export const AuthTypeBearerSchema = z.object({
  type: z.literal('bearer'),
  disabled: z.boolean().optional(),
  token: z.string().optional(),
  prefix: z.string().optional(),
});
export type AuthTypeBearer = z.infer<typeof AuthTypeBearerSchema>;

export const AuthTypeAwsIamSchema = z.object({
  type: z.literal('iam'),
  disabled: z.boolean().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  sessionToken: z.string().optional(),
  region: z.string().optional(),
  service: z.string().optional(),
});
export type AuthTypeAwsIam = z.infer<typeof AuthTypeAwsIamSchema>;

export const AuthTypeNetrcSchema = z.object({
  type: z.literal('netrc'),
  disabled: z.boolean().optional(),
});
export type AuthTypeNetrc = z.infer<typeof AuthTypeNetrcSchema>;

export const AuthTypeAsapSchema = z.object({
  type: z.literal('asap'),
  disabled: z.boolean().optional(),
  issuer: z.string(),
  subject: z.string().optional(),
  audience: z.string(),
  additionalClaims: z.string().optional(),
  privateKey: z.string(),
  keyId: z.string(),
});
export type AuthTypeAsap = z.infer<typeof AuthTypeAsapSchema>;

export const AuthTypeNoneSchema = z.object({
  type: z.literal('none'),
  disabled: z.boolean().optional(),
});
export type AuthTypeNone = z.infer<typeof AuthTypeNoneSchema>;

export const AuthTypeSingleTokenSchema = z.object({
  type: z.literal('singleToken'),
  disabled: z.boolean().optional(),
  token: z.string().optional(),
});
export type AuthTypeSingleToken = z.infer<typeof AuthTypeSingleTokenSchema>;

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

export const AuthenticationSchema = z.union([
  z.discriminatedUnion('type', [
    AuthTypeOAuth2Schema,
    AuthTypeBasicSchema,
    AuthTypeBearerSchema,
    AuthTypeDigestSchema,
    AuthTypeHawkSchema,
    AuthTypeOAuth1Schema,
    AuthTypeAwsIamSchema,
    AuthTypeNetrcSchema,
    AuthTypeAsapSchema,
    AuthTypeNoneSchema,
    AuthTypeAPIKeySchema,
    AuthTypeNTLMSchema,
    AuthTypeSingleTokenSchema,
  ]),
  z.object({}),
]);

export const requestHeaderSchema = z.object({
  name: z.string(),
  id: z.string().optional(),
  value: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
});
export const HeadersSchema = z.array(requestHeaderSchema);
export type RequestHeader = z.infer<typeof requestHeaderSchema>;

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
  multiline?: boolean | string;
  id?: string;
  fileName?: string;
  type?: string;
}

export interface RequestPathParameter {
  name: string;
  value: string;
}

export const PATH_PARAMETER_REGEX = /\/:[^/?#:]+/g;

/** Replace `:param` url segments with their URL-encoded values; unmatched or empty params are left unchanged */
export const applyPathParametersToUrl = (url: string, pathParameters?: RequestPathParameter[]): string => {
  if (!pathParameters?.length) {
    return url;
  }
  return url.replace(PATH_PARAMETER_REGEX, match => {
    const paramName = match.replace('/:', '');
    const param = pathParameters.find(p => p.name === paramName);
    if (param?.value) {
      return `/${encodeURIComponent(param.value)}`;
    }
    return match;
  });
};

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
  disableUserAgentHeader?: boolean;
  konnectRouteKey?: string | null;
  konnectManagedHeaderNames?: string[] | null;
}

export type Request = BaseModel & BaseRequest;

export const isRequest = (model: Pick<BaseModel, 'type'>): model is Request => model.type === type;

export const isRequestId = (id?: string | null) => id?.startsWith(`${prefix}_`);

export const isEventStreamRequest = (model: Pick<BaseModel, 'type'>) =>
  isRequest(model) && model.headers?.find(h => h.name === 'Accept')?.value === 'text/event-stream';

export function getOperationType(request: Request) {
  if (request.body?.mimeType === CONTENT_TYPE_GRAPHQL) {
    let documentAST;
    let requestBody;
    try {
      requestBody = JSON.parse(request.body.text || '');
      documentAST = parse(requestBody?.query || '');
    } catch {
      documentAST = null;
    }
    if (documentAST) {
      const operationAST = getOperationAST(documentAST, requestBody?.operationName);
      if (operationAST) {
        return operationAST.operation;
      }
    }
  }
  return;
}
export const isGraphqlSubscriptionRequest = (model: Pick<BaseModel, 'type'>) =>
  isRequest(model) && getOperationType(model) === OperationTypeNode.SUBSCRIPTION;

export const optionalKeys: (keyof BaseRequest)[] = [
  'konnectRouteKey',
  'konnectManagedHeaderNames',
  'disableUserAgentHeader',
];

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
