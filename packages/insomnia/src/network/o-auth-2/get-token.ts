import * as models from '../../models';
import type { OAuth2Token } from '../../models/o-auth-2-token';
import type { RequestAuthentication, RequestHeader } from '../../models/request';
import { sendWithSettings } from '../network';
import {
  GRANT_TYPE_AUTHORIZATION_CODE,
  GRANT_TYPE_CLIENT_CREDENTIALS,
  GRANT_TYPE_IMPLICIT,
  GRANT_TYPE_PASSWORD,
  X_ERROR,
  X_RESPONSE_ID,
} from './constants';
import { grantAuthCode, grantAuthCodeParams, oauthResponseToAccessToken } from './grant-authorization-code';
import { grantClientCreds } from './grant-client-credentials';
import { grantImplicit, grantImplicitUrl } from './grant-implicit';
import { grantPassword } from './grant-password';
import { getOAuthSession } from './misc';
import { refreshAccessToken } from './refresh-token';
/** Get an OAuth2Token object and also handle storing/saving/refreshing */
const sendOauthRequest = async (requestId: string, url: string, params: RequestHeader[], origin?: string) => {
  const responsePatch = await sendWithSettings(requestId, {
    headers: [
      { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
      { name: 'Accept', value: 'application/x-www-form-urlencoded, application/json' },
      ...(origin ? [{ name: 'Origin', value: origin }] : []),
    ],
    url,
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
  if (authentication.grantType === GRANT_TYPE_AUTHORIZATION_CODE) {
    const params = await grantAuthCodeParams(authentication);
    const response = await sendOauthRequest(requestId, authentication.accessTokenUrl, params, authentication.origin);
    newToken = oauthResponseToAccessToken(authentication.accessTokenUrl, response);
  } else if (authentication.grantType === GRANT_TYPE_PASSWORD) {
    const params = await grantPassword(authentication);
    const response = await sendOauthRequest(requestId, authentication.accessTokenUrl, params, authentication.origin);
    newToken = oauthResponseToAccessToken(authentication.accessTokenUrl, response);
  } else if (authentication.grantType === GRANT_TYPE_CLIENT_CREDENTIALS) {
    newToken = await grantClientCreds(
      requestId,
      authentication
    );
  } else if (authentication.grantType === GRANT_TYPE_IMPLICIT) {
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
    }
  }
  if (newToken) {
    const old = await models.oAuth2Token.getOrCreateByParentId(requestId);
    return models.oAuth2Token.update(old, {
      // Calculate expiry date
      expiresAt: newToken.expires_in ? Date.now() + newToken.expires_in * 1000 : null,
      refreshToken: newToken.refresh_token || null,
      accessToken: newToken.access_token || null,
      identityToken: newToken.id_token || null,
      error: newToken.error || null,
      errorDescription: newToken.error_description || null,
      errorUri: newToken.error_uri || null,
      // Special Cases
      xResponseId: newToken[X_RESPONSE_ID] || null,
      xError: newToken[X_ERROR] || null,
    });
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

  const newToken = await refreshAccessToken(
    requestId,
    token.refreshToken,
    authentication
  );

  // If we didn't receive an access token it means the refresh token didn't succeed,
  // so we tell caller to fetch brand new access and refresh tokens.
  if (!newToken.access_token) {
    return null;
  }

  // ~~~~~~~~~~~~~ //
  // Update the DB //
  // ~~~~~~~~~~~~~ //
  const old = await models.oAuth2Token.getOrCreateByParentId(requestId);
  const expiry = newToken.expires_in ? +newToken.expires_in : 0;
  return models.oAuth2Token.update(old, {
    // Calculate expiry date
    expiresAt: expiry ? Date.now() + expiry * 1000 : null,
    refreshToken: newToken.refresh_token || null,
    accessToken: newToken.access_token || null,
    identityToken: newToken.id_token || null,
    error: newToken.error || null,
    errorDescription: newToken.error_description || null,
    errorUri: newToken.error_uri || null,
    // Special Cases
    xResponseId: newToken[X_RESPONSE_ID] || null,
    xError: newToken[X_ERROR] || null,
  });
}
