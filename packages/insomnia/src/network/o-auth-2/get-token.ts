import crypto from 'crypto';

import { escapeRegex } from '../../common/misc';
import * as models from '../../models';
import type { OAuth2Token } from '../../models/o-auth-2-token';
import type { RequestAuthentication, RequestHeader, RequestParameter } from '../../models/request';
import type { Response } from '../../models/response';
import { invariant } from '../../utils/invariant';
import { setDefaultProtocol } from '../../utils/url/protocol';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import { sendWithSettings } from '../network';
import {
  AuthKeys,
  GRANT_TYPE_AUTHORIZATION_CODE,
  GRANT_TYPE_CLIENT_CREDENTIALS,
  GRANT_TYPE_IMPLICIT,
  GRANT_TYPE_PASSWORD,
  PKCE_CHALLENGE_S256,
  RESPONSE_TYPE_CODE,
  RESPONSE_TYPE_ID_TOKEN,
  RESPONSE_TYPE_ID_TOKEN_TOKEN,
} from './constants';
import { getOAuthSession, insertAuthKeyIf, tryToParse } from './misc';

export const oauthResponseToAccessToken = (accessTokenUrl: string, response: Response) => {
  const bodyBuffer = models.response.getBodyBuffer(response);
  if (!bodyBuffer) {
    return {
      xError: `No body returned from ${accessTokenUrl}`,
      xResponseId: response._id,
    };
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    return {
      xError: `Failed to fetch token url=${accessTokenUrl} status=${response.statusCode}`,
      xResponseId: response._id,
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
    // Special Cases
    xResponseId: accessToken.xResponseId || null,
    xError: accessToken.xError || null,
  };
};

const sendAccessTokenRequest = async (requestId: string, authentication: RequestAuthentication, params: RequestParameter[], headers: RequestHeader[]) => {
  const responsePatch = await sendWithSettings(requestId, {
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
  });
  return await models.response.create(responsePatch);
};

// NOTE
// 1. return valid access token from insomnia db
// 2. send refresh token in order to save and return valid access token
// 3. run a given grant type and save and return valid access token
export const getOAuth2Token = async (
  requestId: string,
  authentication: RequestAuthentication,
  forceRefresh = false,
): Promise<OAuth2Token | null> => {
  const oAuth2Token = await getExisingAccessTokenAndRefreshIfExpired(requestId, authentication, forceRefresh);
  if (oAuth2Token) {
    return oAuth2Token;
  }
  const validGrantTYpe = ['implicit', 'authorization_code', 'password', 'client_credentials'].includes(authentication.grantType);
  invariant(validGrantTYpe, `Invalid grant type ${authentication.grantType}`);
  if (authentication.grantType === GRANT_TYPE_IMPLICIT) {
    const hasNonce = !authentication.responseType || authentication.responseType === RESPONSE_TYPE_ID_TOKEN_TOKEN || authentication.responseType === RESPONSE_TYPE_ID_TOKEN;
    const implicitUrl = new URL(authentication.authorizationUrl);
    [
      { name: 'response_type', value: authentication.responseType },
      { name: 'client_id', value: authentication.clientId },
      ...insertAuthKeyIf(authentication.redirectUrl, 'redirect_uri'),
      ...insertAuthKeyIf(authentication.scope, 'scope'),
      ...insertAuthKeyIf(authentication.state, 'state'),
      ...insertAuthKeyIf(authentication.audience, 'audience'),
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
    const hash = new URL(redirectedTo).hash.slice(1);
    invariant(hash, 'No hash found in redirect URL');
    const data = Object.fromEntries(new URLSearchParams(hash));
    const old = await models.oAuth2Token.getOrCreateByParentId(requestId);
    return models.oAuth2Token.update(old, transformNewAccessTokenToOauthModel({
      ...data,
      access_token: data.access_token || data.id_token,
    }));
  }
  let params: RequestHeader[] = [];
  if (authentication.grantType === GRANT_TYPE_AUTHORIZATION_CODE) {
    const codeVerifier = authentication.usePkce ? encodePKCE(crypto.randomBytes(32)) : '';
    const urlSuccessRegex = new RegExp(`${escapeRegex(authentication.redirectUrl)}.*(code=)`, 'i');
    const urlFailureRegex = new RegExp(`${escapeRegex(authentication.redirectUrl)}.*(error=)`, 'i');
    const sessionId = getOAuthSession();
    invariant(authentication.authorizationUrl, 'Invalid authorization URL');
    invariant(authentication.accessTokenUrl, 'Invalid access token URL');
    const codeChallenge = authentication.pkceMethod !== PKCE_CHALLENGE_S256 ? codeVerifier : encodePKCE(crypto.createHash('sha256').update(codeVerifier).digest());
    const authCodeUrl = new URL(authentication.authorizationUrl);
    [
      { name: 'response_type', value: RESPONSE_TYPE_CODE },
      { name: 'client_id', value: authentication.clientId },
      ...insertAuthKeyIf(authentication.redirectUrl, 'redirect_uri'),
      ...insertAuthKeyIf(authentication.scope, 'scope'),
      ...insertAuthKeyIf(authentication.state, 'state'),
      ...insertAuthKeyIf(authentication.audience, 'audience'),
      ...insertAuthKeyIf(authentication.resource, 'resource'),
      ...(codeChallenge ? [
        { name: 'code_challenge', value: codeChallenge },
        { name: 'code_challenge_method', value: authentication.pkceMethod },
      ] : []),
    ].forEach(p => p.value && authCodeUrl.searchParams.append(p.name, p.value));
    const redirectedTo = await window.main.authorizeUserInWindow({
      url: authCodeUrl.toString(),
      urlSuccessRegex,
      urlFailureRegex,
      sessionId,
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
      ...insertAuthKeyIf(authentication.redirectUrl, 'redirect_uri'),
      ...insertAuthKeyIf(authentication.state, 'state'),
      ...insertAuthKeyIf(authentication.audience, 'audience'),
      ...insertAuthKeyIf(authentication.resource, 'resource'),
      ...insertAuthKeyIf(codeVerifier, 'code_verifier'),
    ];
  } else if (authentication.grantType === GRANT_TYPE_PASSWORD) {
    params = [
      { name: 'grant_type', value: 'password' },
      { name: 'username', value: authentication.username },
      { name: 'password', value: authentication.password },
      ...insertAuthKeyIf(authentication.scope, 'scope'),
      ...insertAuthKeyIf(authentication.audience, 'audience'),
    ];
  } else if (authentication.grantType === GRANT_TYPE_CLIENT_CREDENTIALS) {
    params = [
      { name: 'grant_type', value: 'client_credentials' },
      ...insertAuthKeyIf(authentication.scope, 'scope'),
      ...insertAuthKeyIf(authentication.audience, 'audience'),
      ...insertAuthKeyIf(authentication.resource, 'resource'),
    ];
  }
  const headers = authentication.origin ? [{ name: 'Origin', value: authentication.origin }] : [];
  if (authentication.credentialsInBody) {
    params.push({ name: 'client_id', value: authentication.clientId });
    params.push({ name: 'client_secret', value: authentication.clientSecret });
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

async function getExisingAccessTokenAndRefreshIfExpired(
  requestId: string,
  authentication: RequestAuthentication,
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

  const params = [
    { name: 'grant_type', value: 'refresh_token' },
    { name: 'refresh_token', value: token.refreshToken },
    ...insertAuthKeyIf(authentication.scope, 'scope'),
  ];
  const headers = [];
  if (authentication.credentialsInBody) {
    params.push({ name: 'client_id', value: authentication.clientId });
    params.push({ name: 'client_secret', value: authentication.clientSecret });
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
  if (isSuccessful) {
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

export const encodePKCE = (buffer: Buffer) => {
  return buffer.toString('base64')
    // The characters + / = are reserved for PKCE as per the RFC,
    // so we replace them with unreserved characters
    // Docs: https://tools.ietf.org/html/rfc7636#section-4.2
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};
