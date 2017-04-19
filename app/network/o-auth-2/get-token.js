/**
 * Get an OAuth2Token object and also handle storing/saving/refreshing
 * @returns {Promise.<void>}
 */
import getAccessTokenAuthorizationCode from './grant-authorization-code';
import getAccessTokenClientCredentials from './grant-client-credentials';
import getAccessTokenPassword from './grant-password';
import getAccessTokenImplicit from './grant-implicit';
import refreshAccessToken from './refresh-token';
import {GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_CLIENT_CREDENTIALS, GRANT_TYPE_IMPLICIT, GRANT_TYPE_PASSWORD, P_ACCESS_TOKEN, P_ERROR, P_ERROR_DESCRIPTION, P_ERROR_URI, P_EXPIRES_IN, P_REFRESH_TOKEN} from './constants';
import * as models from '../../models';

export default async function (requestId, authentication, forceRefresh = false) {
  switch (authentication.grantType) {
    case GRANT_TYPE_AUTHORIZATION_CODE:
      return _getOAuth2AuthorizationCodeHeader(requestId, authentication, forceRefresh);
    case GRANT_TYPE_CLIENT_CREDENTIALS:
      return _getOAuth2ClientCredentialsHeader(requestId, authentication, forceRefresh);
    case GRANT_TYPE_IMPLICIT:
      return _getOAuth2ImplicitHeader(requestId, authentication, forceRefresh);
    case GRANT_TYPE_PASSWORD:
      return _getOAuth2PasswordHeader(requestId, authentication, forceRefresh);
  }

  return null;
}

async function _getOAuth2AuthorizationCodeHeader (requestId, authentication, forceRefresh) {
  const oAuth2Token = await _getAccessToken(requestId, authentication, forceRefresh);

  if (oAuth2Token) {
    return oAuth2Token;
  }

  const results = await getAccessTokenAuthorizationCode(
    authentication.authorizationUrl,
    authentication.accessTokenUrl,
    authentication.credentialsInBody,
    authentication.clientId,
    authentication.clientSecret,
    authentication.redirectUrl,
    authentication.scope,
    authentication.state
  );

  return _updateOAuth2Token(requestId, results);
}

async function _getOAuth2ClientCredentialsHeader (requestId, authentication, forceRefresh) {
  const oAuth2Token = await _getAccessToken(requestId, authentication, forceRefresh);

  if (oAuth2Token) {
    return oAuth2Token;
  }

  const results = await getAccessTokenClientCredentials(
    authentication.accessTokenUrl,
    authentication.credentialsInBody,
    authentication.clientId,
    authentication.clientSecret,
    authentication.scope
  );

  return _updateOAuth2Token(requestId, results);
}

async function _getOAuth2ImplicitHeader (requestId, authentication, forceRefresh) {
  const oAuth2Token = await _getAccessToken(requestId, authentication, forceRefresh);

  if (oAuth2Token) {
    return oAuth2Token;
  }

  const results = await getAccessTokenImplicit(
    authentication.authorizationUrl,
    authentication.clientId,
    authentication.redirectUrl,
    authentication.scope,
    authentication.state
  );

  return _updateOAuth2Token(requestId, results);
}

async function _getOAuth2PasswordHeader (requestId, authentication, forceRefresh) {
  const oAuth2Token = await _getAccessToken(requestId, authentication, forceRefresh);

  if (oAuth2Token) {
    return oAuth2Token;
  }

  const results = await getAccessTokenPassword(
    authentication.accessTokenUrl,
    authentication.credentialsInBody,
    authentication.clientId,
    authentication.clientSecret,
    authentication.username,
    authentication.password,
    authentication.scope
  );

  return _updateOAuth2Token(requestId, results);
}

async function _getAccessToken (requestId, authentication, forceRefresh) {
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // See if we have a token already //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  let token = await models.oAuth2Token.getByParentId(requestId);

  if (!token) {
    return null;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Check if the token needs refreshing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  // Refresh tokens are part of Auth Code, Password
  const isExpired = token.expiresAt ? Date.now() > token.expiresAt : false;

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

  const refreshResults = await refreshAccessToken(
    authentication.accessTokenUrl,
    authentication.credentialsInBody,
    authentication.clientId,
    authentication.clientSecret,
    token.refreshToken,
    authentication.scope
  );

  // ~~~~~~~~~~~~~ //
  // Update the DB //
  // ~~~~~~~~~~~~~ //

  return _updateOAuth2Token(requestId, refreshResults);
}

async function _updateOAuth2Token (requestId, authResults) {
  const oAuth2Token = await models.oAuth2Token.getOrCreateByParentId(requestId);

  // Calculate expiry date
  const expiresIn = authResults[P_EXPIRES_IN];
  const expiresAt = expiresIn ? (Date.now() + (expiresIn * 1000)) : null;

  return models.oAuth2Token.update(oAuth2Token, {
    expiresAt,
    refreshToken: authResults[P_REFRESH_TOKEN] || null,
    accessToken: authResults[P_ACCESS_TOKEN] || null,
    error: authResults[P_ERROR] || null,
    errorDescription: authResults[P_ERROR_DESCRIPTION] || null,
    errorUri: authResults[P_ERROR_URI] || null
  });
}
