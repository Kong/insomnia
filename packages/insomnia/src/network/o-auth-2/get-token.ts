import * as models from '../../models';
import type { OAuth2Token } from '../../models/o-auth-2-token';
import type { RequestAuthentication } from '../../models/request';
import {
  GRANT_TYPE_AUTHORIZATION_CODE,
  GRANT_TYPE_CLIENT_CREDENTIALS,
  GRANT_TYPE_IMPLICIT,
  GRANT_TYPE_PASSWORD,
  X_ERROR,
  X_RESPONSE_ID,
} from './constants';
import { grantAuthCode } from './grant-authorization-code';
import { grantClientCreds } from './grant-client-credentials';
import { grantImplicit } from './grant-implicit';
import { grantPassword } from './grant-password';
import { refreshAccessToken } from './refresh-token';
/** Get an OAuth2Token object and also handle storing/saving/refreshing */

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
    newToken = await grantAuthCode(
      requestId,
      authentication.authorizationUrl,
      authentication.accessTokenUrl,
      authentication.credentialsInBody,
      authentication.clientId,
      authentication.clientSecret,
      authentication.redirectUrl,
      authentication.scope,
      authentication.state,
      authentication.audience,
      authentication.resource,
      authentication.usePkce,
      authentication.pkceMethod,
      authentication.origin,
    );
  } else if (authentication.grantType === GRANT_TYPE_CLIENT_CREDENTIALS) {
    newToken = await grantClientCreds(
      requestId,
      authentication.accessTokenUrl,
      authentication.credentialsInBody,
      authentication.clientId,
      authentication.clientSecret,
      authentication.scope,
      authentication.audience,
      authentication.resource,
    );
  } else if (authentication.grantType === GRANT_TYPE_IMPLICIT) {
    newToken = await grantImplicit(
      requestId,
      authentication.authorizationUrl,
      authentication.clientId,
      authentication.responseType,
      authentication.redirectUrl,
      authentication.scope,
      authentication.state,
      authentication.audience,
    );
  } else if (authentication.grantType === GRANT_TYPE_PASSWORD) {
    newToken = await grantPassword(
      requestId,
      authentication.accessTokenUrl,
      authentication.credentialsInBody,
      authentication.clientId,
      authentication.clientSecret,
      authentication.username,
      authentication.password,
      authentication.scope,
      authentication.audience,
    );
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
    authentication.accessTokenUrl,
    authentication.credentialsInBody,
    authentication.clientId,
    authentication.clientSecret,
    token.refreshToken,
    authentication.scope,
    authentication.origin,
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
