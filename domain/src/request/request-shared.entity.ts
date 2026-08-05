// Nested types shared by the HTTP Request and (a subset of) the WebSocket/Socket.IO/MCP request
// variants. Defined once here rather than per-variant.

export type OAuth1SignatureMethod = 'HMAC-SHA1' | 'RSA-SHA1' | 'HMAC-SHA256' | 'PLAINTEXT';

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

export type OAuth2ResponseType = 'code' | 'id_token' | 'id_token token' | 'none' | 'token';

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
  launchBrowserManually?: boolean;
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
  multiline?: boolean | string;
  id?: string;
  fileName?: string;
  type?: string;
}

export interface RequestPathParameter {
  name: string;
  value: string;
}

export interface RequestBody {
  mimeType?: string | null;
  text?: string;
  fileName?: string;
  params?: RequestBodyParameter[];
}
