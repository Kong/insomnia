import crypto from 'crypto';

import * as models from '../../models';
import type { OAuth2Token } from '../../models/o-auth-2-token';
import type { RequestAuthentication, RequestHeader, RequestParameter } from '../../models/request';
import type { Response } from '../../models/response';
import { invariant } from '../../utils/invariant';
import { setDefaultProtocol } from '../../utils/url/protocol';
import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../utils/url/querystring';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import { sendWithSettings } from '../network';
import {
  AuthKeys,
  GRANT_TYPE_AUTHORIZATION_CODE,
  GRANT_TYPE_CLIENT_CREDENTIALS,
  GRANT_TYPE_IMPLICIT,
  GRANT_TYPE_PASSWORD,
  RESPONSE_TYPE_ID_TOKEN,
  RESPONSE_TYPE_ID_TOKEN_TOKEN,
} from './constants';
import { encodePKCE, grantAuthCodeParams } from './grant-authorization-code';
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

  const oAuth2Token = await _getExisingAccessTokenAndRefreshIfExpired(requestId, authentication, forceRefresh);

  if (oAuth2Token) {
    return oAuth2Token;
  }
  if (authentication.grantType === GRANT_TYPE_IMPLICIT) {
    const params = [
      { name: 'response_type', value: authentication.responseType },
      { name: 'client_id', value: authentication.clientId },
      ...insertAuthKeyIf(authentication.redirectUrl, 'redirect_uri'),
      ...insertAuthKeyIf(authentication.scope, 'scope'),
      ...insertAuthKeyIf(authentication.state, 'state'),
      ...insertAuthKeyIf(authentication.audience, 'audience'),
      ...(!authentication.responseType || authentication.responseType === RESPONSE_TYPE_ID_TOKEN_TOKEN || authentication.responseType === RESPONSE_TYPE_ID_TOKEN ? [{
        name: 'nonce', value: Math.floor(Math.random() * 9999999999999) + 1 + '',
      }] : [])];
    const implicitUrl = joinUrlAndQueryString(authentication.authorizationUrl, buildQueryStringFromParams(params));
    const redirectedTo = await window.main.authorizeUserInWindow({
      url: implicitUrl,
      urlSuccessRegex: /(access_token=|id_token=)/,
      urlFailureRegex: /(error=)/,
      sessionId: getOAuthSession(),
    });
    const hash = new URL(redirectedTo).hash.slice(1);
    if (hash) {
      const data = Object.fromEntries(new URLSearchParams(hash));
      const old = await models.oAuth2Token.getOrCreateByParentId(requestId);
      return models.oAuth2Token.update(old, transformNewAccessTokenToOauthModel({
        ...data,
        access_token: data.access_token || data.id_token,
      }));
    }
  } else {
    let params: RequestHeader[] = [];
    if (authentication.grantType === GRANT_TYPE_AUTHORIZATION_CODE) {
      const codeVerifier = authentication.usePkce ? encodePKCE(crypto.randomBytes(32)) : '';
      const redirectCode = await grantAuthCodeParams(authentication, codeVerifier);
      params = [
        { name: 'grant_type', value: GRANT_TYPE_AUTHORIZATION_CODE },
        { name: 'code', value: redirectCode },
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
  }
  return null;
};

async function _getExisingAccessTokenAndRefreshIfExpired(
  requestId: string,
  authentication: RequestAuthentication,
  forceRefresh: boolean,
): Promise<OAuth2Token | null> {
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // See if we have a token already //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  const token: OAuth2Token | null = await models.oAuth2Token.getByParentId(requestId);

  if (!token) {
    return null;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Check if the token needs refreshing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Refresh tokens are part of Auth Code, Password
  const expiresAt = token.expiresAt || Infinity;
  const isExpired = Date.now() > expiresAt;

  if (!isExpired && !forceRefresh) {
    return token;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Refresh the token if necessary //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // We've expired, but don't have a refresh token, so tell caller to fetch new
  // access token
  if (!token.refreshToken) {
    return null;
  }
  const {
    accessTokenUrl,
    credentialsInBody,
    clientId,
    clientSecret,
    scope,
  } = authentication;
  const params = [
    {
      name: 'grant_type',
      value: 'refresh_token',
    },
    {
      name: 'refresh_token',
      value: token.refreshToken,
    },
    ...insertAuthKeyIf(scope, 'scope'),
    ...(credentialsInBody ? [{
      name: 'client_id',
      value: clientId,
    }, {
      name: 'client_secret',
      value: clientSecret,
    }] : [getBasicAuthHeader(clientId, clientSecret)]),
  ];
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
  if (statusCode < 200 || statusCode >= 300) {
    if (bodyBuffer && statusCode === 400) {
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

    throw new Error(`[oauth2] Failed to refresh token url=${accessTokenUrl} status=${statusCode}`);
  }
  invariant(bodyBuffer, `[oauth2] No body returned from ${accessTokenUrl}`);
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
