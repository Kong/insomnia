import crypto from 'crypto';
import querystring from 'querystring';
import { v4 as uuidv4 } from 'uuid';

import { escapeRegex } from '../../common/misc';
import * as models from '../../models';
import type { OAuth2Token } from '../../models/o-auth-2-token';
import type { AuthTypeOAuth2, OAuth2ResponseType, RequestHeader, RequestParameter } from '../../models/request';
import type { Request } from '../../models/request';
import type { Response } from '../../models/response';
import { invariant } from '../../utils/invariant';
import { setDefaultProtocol } from '../../utils/url/protocol';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import { fetchRequestData, responseTransform, sendCurlAndWriteTimeline, tryToInterpolateRequest, tryToTransformRequestWithPlugins } from '../network';
import {
  AuthKeys,
  GRANT_TYPE_AUTHORIZATION_CODE,
  PKCE_CHALLENGE_S256,
} from './constants';

const LOCALSTORAGE_KEY_SESSION_ID = 'insomnia::current-oauth-session-id';

export function initNewOAuthSession() {
  // the value of this variable needs to start with 'persist:'
  // otherwise sessions won't be persisted over application-restarts
  const authWindowSessionId = `persist:oauth2_${uuidv4()}`;
  window.localStorage.setItem(LOCALSTORAGE_KEY_SESSION_ID, authWindowSessionId);
  return authWindowSessionId;
}

export function getOAuthSession(): string {
  const token = window.localStorage.getItem(LOCALSTORAGE_KEY_SESSION_ID);
  return token || initNewOAuthSession();
}

// NOTE
// 1. return valid access token from insomnia db
// 2. send refresh token in order to save and return valid access token
// 3. run a given grant type and save and return valid access token
export const getOAuth2Token = async (
  requestId: string,
  authentication: AuthTypeOAuth2,
  forceRefresh = false,
): Promise<OAuth2Token | null> => {
  const oAuth2Token = await getExistingAccessTokenAndRefreshIfExpired(requestId, authentication, forceRefresh);
  if (oAuth2Token) {
    return oAuth2Token;
  }
  const validGrantType = ['implicit', 'authorization_code', 'password', 'client_credentials'].includes(authentication.grantType);
  invariant(validGrantType, `Invalid grant type ${authentication.grantType}`);
  if (authentication.grantType === 'implicit') {
    invariant(authentication.authorizationUrl, 'Missing authorization URL');
    const responseTypeOrFallback = authentication.responseType || 'token';
    const hasNonce = responseTypeOrFallback === 'id_token token' || responseTypeOrFallback === 'id_token';
    const implicitUrl = new URL(authentication.authorizationUrl);
    [
      { name: 'response_type', value: responseTypeOrFallback },
      { name: 'client_id', value: authentication.clientId },
      ...insertAuthKeyIf('redirect_uri', authentication.redirectUrl),
      ...insertAuthKeyIf('scope', authentication.scope),
      ...insertAuthKeyIf('state', authentication.state),
      ...insertAuthKeyIf('audience', authentication.audience),
      ...(hasNonce ? [{
        name: 'nonce', value: Math.floor(Math.random() * 9999999999999) + 1 + '',
      }] : []),
    ].forEach(p => p.value && implicitUrl.searchParams.append(p.name, p.value));
    const redirectedTo = await window.main.authorizeUserInWindow({
      url: implicitUrl.toString(),
      urlSuccessRegex: /(access_token=|id_token=)/,
      urlFailureRegex: /(error=)/,
      sessionId: getOAuthSession(),
    });
    console.log('[oauth2] Detected redirect ' + redirectedTo);

    const responseUrl = new URL(redirectedTo);
    if (responseUrl.searchParams.has('error')) {
      const params = Object.fromEntries(responseUrl.searchParams);
      const old = await models.oAuth2Token.getOrCreateByParentId(requestId);
      return models.oAuth2Token.update(old, transformNewAccessTokenToOauthModel(params));
    }
    const hash = responseUrl.hash.slice(1);
    invariant(hash, 'No hash found in response URL from OAuth2 provider');
    const data = Object.fromEntries(new URLSearchParams(hash));
    const old = await models.oAuth2Token.getOrCreateByParentId(requestId);
    return models.oAuth2Token.update(old, transformNewAccessTokenToOauthModel({
      ...data,
      access_token: data.access_token || data.id_token,
    }));
  }
  invariant(authentication.accessTokenUrl, 'Missing access token URL');
  let params: RequestHeader[] = [];
  if (authentication.grantType === 'authorization_code') {
    invariant(authentication.authorizationUrl, 'Invalid authorization URL');

    const codeVerifier = authentication.usePkce ? encodePKCE(crypto.randomBytes(32)) : '';
    const usePkceAnd256 = authentication.usePkce && authentication.pkceMethod === PKCE_CHALLENGE_S256;
    const codeChallenge = usePkceAnd256 ? encodePKCE(crypto.createHash('sha256').update(codeVerifier).digest()) : codeVerifier;
    const authCodeUrl = new URL(authentication.authorizationUrl);
    const responseType: OAuth2ResponseType = 'code';
    [
      { name: 'response_type', value: responseType },
      { name: 'client_id', value: authentication.clientId },
      ...insertAuthKeyIf('redirect_uri', authentication.redirectUrl),
      ...insertAuthKeyIf('scope', authentication.scope),
      ...insertAuthKeyIf('state', authentication.state),
      ...insertAuthKeyIf('audience', authentication.audience),
      ...insertAuthKeyIf('resource', authentication.resource),
      ...(codeChallenge ? [
        { name: 'code_challenge', value: codeChallenge },
        { name: 'code_challenge_method', value: authentication.pkceMethod },
      ] : []),
    ].forEach(p => p.value && authCodeUrl.searchParams.append(p.name, p.value));
    const redirectedTo = await window.main.authorizeUserInWindow({
      url: authCodeUrl.toString(),
      urlSuccessRegex: authentication.redirectUrl ?
        new RegExp(`${escapeRegex(authentication.redirectUrl)}.*([?&]code=)`, 'i') : /([?&]code=)/i,
      urlFailureRegex: authentication.redirectUrl ?
        new RegExp(`${escapeRegex(authentication.redirectUrl)}.*([?&]error=)`, 'i') : /([?&]error=)/i,
      sessionId: getOAuthSession(),
    });
    console.log('[oauth2] Detected redirect ' + redirectedTo);
    const redirectParams = Object.fromEntries(new URL(redirectedTo).searchParams);
    if (redirectParams.error) {
      const code = redirectParams.error;
      const msg = redirectParams.error_description;
      const uri = redirectParams.error_uri;
      throw new Error(`OAuth 2.0 Error ${code}\n\n${msg}\n\n${uri}`);
    }
    params = [
      { name: 'grant_type', value: GRANT_TYPE_AUTHORIZATION_CODE },
      { name: 'code', value: redirectParams.code },
      ...insertAuthKeyIf('redirect_uri', authentication.redirectUrl),
      ...insertAuthKeyIf('state', authentication.state),
      ...insertAuthKeyIf('audience', authentication.audience),
      ...insertAuthKeyIf('resource', authentication.resource),
      ...insertAuthKeyIf('code_verifier', codeVerifier),
    ];
  } else if (authentication.grantType === 'password') {
    params = [
      { name: 'grant_type', value: 'password' },
      ...insertAuthKeyIf('username', authentication.username),
      ...insertAuthKeyIf('password', authentication.password),
      ...insertAuthKeyIf('scope', authentication.scope),
      ...insertAuthKeyIf('audience', authentication.audience),
    ];
  } else if (authentication.grantType === 'client_credentials') {
    params = [
      { name: 'grant_type', value: 'client_credentials' },
      ...insertAuthKeyIf('scope', authentication.scope),
      ...insertAuthKeyIf('audience', authentication.audience),
      ...insertAuthKeyIf('resource', authentication.resource),
    ];
  }
  const headers = authentication.origin ? [{ name: 'Origin', value: authentication.origin }] : [];
  if (authentication.credentialsInBody) {
    params = [
      ...params,
      ...insertAuthKeyIf('client_id', authentication.clientId),
      ...insertAuthKeyIf('client_secret', authentication.clientSecret),
    ];
  } else {
    headers.push(getBasicAuthHeader(authentication.clientId, authentication.clientSecret));
  }

  const response = await sendAccessTokenRequest(requestId, authentication, params, headers);
  const old = await models.oAuth2Token.getOrCreateByParentId(requestId);
  return models.oAuth2Token.update(old, transformNewAccessTokenToOauthModel(
    oauthResponseToAccessToken(authentication.accessTokenUrl, response)
  ));
};
// 1. get token from db and return if valid
// 2. if expired, and no refresh token return null
// 3. run refresh token query and return new token or null if it fails

async function getExistingAccessTokenAndRefreshIfExpired(
  requestId: string,
  authentication: AuthTypeOAuth2,
  forceRefresh: boolean,
): Promise<OAuth2Token | null> {
  const token: OAuth2Token | null = await models.oAuth2Token.getByParentId(requestId);
  if (!token) {
    return null;
  }
  const expiresAt = token.expiresAt || Infinity;
  const isExpired = Date.now() > expiresAt;
  if (!isExpired && !forceRefresh) {
    return token;
  }
  if (!token.refreshToken) {
    return null;
  }

  let params = [
    { name: 'grant_type', value: 'refresh_token' },
    { name: 'refresh_token', value: token.refreshToken },
    ...insertAuthKeyIf('scope', authentication.scope),
  ];
  const headers = [];
  if (authentication.credentialsInBody) {
    params = [
      ...params,
      ...insertAuthKeyIf('client_id', authentication.clientId),
      ...insertAuthKeyIf('client_secret', authentication.clientSecret),
    ];
  } else {
    headers.push(getBasicAuthHeader(authentication.clientId, authentication.clientSecret));
  }
  const response = await sendAccessTokenRequest(requestId, authentication, params, []);

  const statusCode = response.statusCode || 0;
  const bodyBuffer = models.response.getBodyBuffer(response);

  if (statusCode === 401) {
    // If the refresh token was rejected due an unauthorized request, we will
    // return a null access_token to trigger an authentication request to fetch
    // brand new refresh and access tokens.
    const old = await models.oAuth2Token.getOrCreateByParentId(requestId);
    models.oAuth2Token.update(old, transformNewAccessTokenToOauthModel({ access_token: null }));
    return null;
  }
  const isSuccessful = statusCode >= 200 && statusCode < 300;
  const hasBodyAndIsError = bodyBuffer && statusCode === 400;
  if (!isSuccessful) {
    if (hasBodyAndIsError) {
      const body = tryToParse(bodyBuffer.toString());
      // If the refresh token was rejected due an oauth2 invalid_grant error, we will
      // return a null access_token to trigger an authentication request to fetch
      // brand new refresh and access tokens.
      if (body?.error === 'invalid_grant') {
        console.log(`[oauth2] Refresh token rejected due to invalid_grant error: ${body.error_description}`);
        const old = await models.oAuth2Token.getOrCreateByParentId(requestId);
        models.oAuth2Token.update(old, transformNewAccessTokenToOauthModel({ access_token: null }));
        return null;
      }
    }

    throw new Error(`[oauth2] Failed to refresh token url=${authentication.accessTokenUrl} status=${statusCode}`);
  }
  invariant(bodyBuffer, `[oauth2] No body returned from ${authentication.accessTokenUrl}`);
  const data = tryToParse(bodyBuffer.toString());
  if (!data) {
    return null;
  }
  const old = await models.oAuth2Token.getOrCreateByParentId(requestId);
  return models.oAuth2Token.update(old, transformNewAccessTokenToOauthModel({
    ...data,
    refresh_token: data.refresh_token || token.refreshToken,
  }));
}

export const oauthResponseToAccessToken = (accessTokenUrl: string, response: Response) => {
  const bodyBuffer = models.response.getBodyBuffer(response);
  if (!bodyBuffer) {
    return {
      xResponseId: response._id,
      xError: `No body returned from ${accessTokenUrl}`,
    };
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    return {
      xResponseId: response._id,
      xError: `Failed to fetch token url=${accessTokenUrl} status=${response.statusCode}`,
    };
  }
  const body = bodyBuffer.toString('utf8');
  const data = tryToParse(body);
  return {
    ...data,
    xResponseId: response._id,
  };
};

const transformNewAccessTokenToOauthModel = (accessToken: Partial<Record<AuthKeys, string | null>>): Partial<OAuth2Token> => {
  const expiry = accessToken.expires_in ? +accessToken.expires_in : 0;
  return {
    // Calculate expiry date
    expiresAt: accessToken.expires_in ? Date.now() + expiry * 1000 : null,
    refreshToken: accessToken.refresh_token || undefined,
    accessToken: accessToken.access_token || undefined,
    identityToken: accessToken.id_token || undefined,
    error: accessToken.error || undefined,
    errorDescription: accessToken.error_description || undefined,
    errorUri: accessToken.error_uri || undefined,
    // Special Case for response timeline viewing
    xResponseId: accessToken.xResponseId || null,
    // Special Case for empty body or http error code custom messages
    xError: accessToken.xError || null,
  };
};

const sendAccessTokenRequest = async (requestId: string, authentication: AuthTypeOAuth2, params: RequestParameter[], headers: RequestHeader[]) => {
  invariant(authentication.accessTokenUrl, 'Missing access token URL');
  console.log(`[network] Sending with settings req=${requestId}`);
  // @TODO unpack oauth into regular timeline and remove oauth timeine dialog
  const { request,
    environment,
    settings,
    clientCertificates,
    caCert,
    activeEnvironmentId } = await fetchRequestData(requestId);

  const newRequest: Request = await models.initModel(models.request.type, {
    headers: [
      { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
      { name: 'Accept', value: 'application/x-www-form-urlencoded, application/json' },
      ...headers,
    ],
    url: setDefaultProtocol(authentication.accessTokenUrl),
    method: 'POST',
    body: {
      mimeType: 'application/x-www-form-urlencoded',
      params,
    },
  }, {
    _id: request._id + '.other',
    parentId: request._id,
  });

  const renderResult = await tryToInterpolateRequest(newRequest, environment._id);
  const renderedRequest = await tryToTransformRequestWithPlugins(renderResult);

  const response = await sendCurlAndWriteTimeline(
    renderResult.request,
    clientCertificates,
    caCert,
    { ...settings, validateSSL: settings.validateAuthSSL },
  );
  const responsePatch = await responseTransform(response, activeEnvironmentId, renderedRequest, renderResult.context);

  return await models.response.create(responsePatch);
};
export const encodePKCE = (buffer: Buffer) => {
  return buffer.toString('base64')
    // The characters + / = are reserved for PKCE as per the RFC,
    // so we replace them with unreserved characters
    // Docs: https://tools.ietf.org/html/rfc7636#section-4.2
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};
const tryToParse = (body: string): Record<string, any> | null => {
  try {
    return JSON.parse(body);
  } catch (err) { }

  try {
    // NOTE: parse does not return a JS Object, so
    //   we cannot use hasOwnProperty on it
    return querystring.parse(body);
  } catch (err) { }
  return null;
};

const insertAuthKeyIf = (name: AuthKeys, value?: string) => value ? [{ name, value }] : [];
