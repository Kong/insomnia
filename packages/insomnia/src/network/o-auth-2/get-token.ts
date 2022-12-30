import * as models from '../../models';
import type { OAuth2Token } from '../../models/o-auth-2-token';
import type { RequestAuthentication, RequestHeader } from '../../models/request';
import type { Response } from '../../models/response';
import { invariant } from '../../utils/invariant';
import { setDefaultProtocol } from '../../utils/url/protocol';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import { sendWithSettings } from '../network';
import {
  GRANT_TYPE_AUTHORIZATION_CODE,
  GRANT_TYPE_CLIENT_CREDENTIALS,
  GRANT_TYPE_IMPLICIT,
  GRANT_TYPE_PASSWORD,
  X_ERROR,
  X_RESPONSE_ID,
} from './constants';
import { grantAuthCodeParams } from './grant-authorization-code';
import { grantClientCreds } from './grant-client-credentials';
import { grantImplicitUrl } from './grant-implicit';
import { grantPassword } from './grant-password';
import { getOAuthSession, insertAuthKeyIf, tryToParse } from './misc';
import { refreshAccessToken } from './refresh-token';

export const oauthResponseToAccessToken = (accessTokenUrl: string, response: Response) => {
  const bodyBuffer = models.response.getBodyBuffer(response);
  if (!bodyBuffer) {
    return {
      [X_ERROR]: `No body returned from ${accessTokenUrl}`,
      [X_RESPONSE_ID]: response._id,
    };
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    return {
      [X_ERROR]: `Failed to fetch token url=${accessTokenUrl} status=${response.statusCode}`,
      [X_RESPONSE_ID]: response._id,
    };
  }
  const body = bodyBuffer.toString('utf8');
  const data = tryToParse(body);
  return {
    ...data,
    [X_RESPONSE_ID]: response._id,
  };
};

const sendAccessTokenRequest = async (requestId: string, url: string, params: RequestHeader[], origin?: string) => {
  const responsePatch = await sendWithSettings(requestId, {
    headers: [
      { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
      { name: 'Accept', value: 'application/x-www-form-urlencoded, application/json' },
      ...(origin ? [{ name: 'Origin', value: origin }] : []),
    ],
    url: setDefaultProtocol(url),
    method: 'POST',
    body: {
      mimeType: 'application/x-www-form-urlencoded',
      params,
    },
  });
  return await models.response.create(responsePatch);
};
export const getOAuth2Token = async (
  requestId: string,
  authentication: RequestAuthentication,
  forceRefresh = false,
): Promise<OAuth2Token | null> => {

  const oAuth2Token = await _getExisingAccessTokenAndRefreshIfExpired(requestId, authentication, forceRefresh);

  if (oAuth2Token) {
    return oAuth2Token;
  }
  let newToken;
  if (authentication.grantType === GRANT_TYPE_IMPLICIT) {
    newToken = {};
    const implicitUrl = grantImplicitUrl(authentication);
    const redirectedTo = await window.main.authorizeUserInWindow({
      url: implicitUrl,
      urlSuccessRegex: /(access_token=|id_token=)/,
      urlFailureRegex: /(error=)/,
      sessionId: getOAuthSession(),
    });
    const hash = new URL(redirectedTo).hash.slice(1);
    if (hash) {
      const data = Object.fromEntries(new URLSearchParams(hash));
      newToken = {
        ...data,
        access_token: data.access_token || data._id_token,
      };
      const old = await models.oAuth2Token.getOrCreateByParentId(requestId);
      return models.oAuth2Token.update(old, transformNewAccessTokenToOauthModel(newToken));
    }
  } else {
    let params: RequestHeader[] = [];
    if (authentication.grantType === GRANT_TYPE_AUTHORIZATION_CODE) {
      params = await grantAuthCodeParams(authentication);
    } else if (authentication.grantType === GRANT_TYPE_PASSWORD) {
      params = await grantPassword(authentication);
    } else if (authentication.grantType === GRANT_TYPE_CLIENT_CREDENTIALS) {
      params = await grantClientCreds(authentication);
    }
    const response = await sendAccessTokenRequest(requestId, authentication.accessTokenUrl, params, authentication.origin);
    newToken = oauthResponseToAccessToken(authentication.accessTokenUrl, response);
    const old = await models.oAuth2Token.getOrCreateByParentId(requestId);
    return models.oAuth2Token.update(old, transformNewAccessTokenToOauthModel(newToken));
  }
  return null;
};

const transformNewAccessTokenToOauthModel = (accessToken: Record<string, string>): OAuth2Token => {
  const expiry = accessToken.expires_in ? +accessToken.expires_in : 0;
  return {
    // Calculate expiry date
    expiresAt: accessToken.expires_in ? Date.now() + expiry * 1000 : null,
    refreshToken: accessToken.refresh_token || null,
    accessToken: accessToken.access_token || null,
    identityToken: accessToken.id_token || null,
    error: accessToken.error || null,
    errorDescription: accessToken.error_description || null,
    errorUri: accessToken.error_uri || null,
    // Special Cases
    xResponseId: accessToken[X_RESPONSE_ID] || null,
    xError: accessToken[X_ERROR] || null,
  };
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
  ], ;
  const response = await sendAccessTokenRequest(requestId, authentication.accessTokenUrl, params, authentication.origin);

  const statusCode = response.statusCode || 0;
  const bodyBuffer = models.response.getBodyBuffer(response);

  if (statusCode === 401) {
    // If the refresh token was rejected due an unauthorized request, we will
    // return a null access_token to trigger an authentication request to fetch
    // brand new refresh and access tokens.
    newToken = { access_token: null };
  } else if (statusCode < 200 || statusCode >= 300) {
    if (bodyBuffer && statusCode === 400) {
      const body = tryToParse(bodyBuffer.toString());
      // If the refresh token was rejected due an oauth2 invalid_grant error, we will
      // return a null access_token to trigger an authentication request to fetch
      // brand new refresh and access tokens.
      if (body?.error === 'invalid_grant') {
        console.log(`[oauth2] Refresh token rejected due to invalid_grant error: ${body.error_description}`);
        newToken = { access_token: null };
      }
    }

    throw new Error(`[oauth2] Failed to refresh token url=${accessTokenUrl} status=${statusCode}`);
  } else {
    invariant(bodyBuffer, `[oauth2] No body returned from ${accessTokenUrl}`);
    const data = tryToParse(bodyBuffer.toString());
    const keys =
      [
        'access_token',
        'id_token',
        'refresh_token',
        'expires_in',
        'token_type',
        'scope',
        'error',
        'error_uri',
        'error_description',
      ];

    const results = Object.fromEntries(keys.map(key => [key, data?.[key] !== undefined ? data[key] : null]));

    if (results.refresh_token !== undefined) {
      results.refresh_token = token.refreshToken;
    }
    newToken = results;
  }
  // If we didn't receive an access token it means the refresh token didn't succeed,
  // so we tell caller to fetch brand new access and refresh tokens.
  if (!newToken.access_token) {
    return null;
  }

  // ~~~~~~~~~~~~~ //
  // Update the DB //
  // ~~~~~~~~~~~~~ //
  const old = await models.oAuth2Token.getOrCreateByParentId(requestId);
  return models.oAuth2Token.update(old, transformNewAccessTokenToOauthModel(newToken));
}
