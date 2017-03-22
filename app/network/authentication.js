import {AUTH_BASIC, AUTH_OAUTH_2} from '../common/constants';
import getAccessTokenAuthorizationCode from './o-auth-2/grant-authorization-code';
import getAccessTokenClientCredentials from './o-auth-2/grant-client-credentials';
import getAccessTokenPassword from './o-auth-2/grant-password';
import getAccessTokenImplicit from './o-auth-2/grant-implicit';
import {GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_IMPLICIT, GRANT_TYPE_PASSWORD, GRANT_TYPE_CLIENT_CREDENTIALS, Q_REFRESH_TOKEN, Q_EXPIRES_IN, Q_ACCESS_TOKEN} from './o-auth-2/constants';
import {getBasicAuthHeader} from '../common/misc';
import * as models from '../models';
import refreshAccessToken from './o-auth-2/refresh-token';

export async function getAuthHeader (requestId, authentication) {
  if (authentication.disabled) {
    return null;
  }

  if (authentication.type === AUTH_BASIC) {
    const {username, password} = authentication;
    return getBasicAuthHeader(username, password);
  }

  if (authentication.type === AUTH_OAUTH_2) {
    switch (authentication.grantType) {
      case GRANT_TYPE_AUTHORIZATION_CODE:
        return _getOAuth2AuthorizationCodeHeader(requestId, authentication);
      case GRANT_TYPE_CLIENT_CREDENTIALS:
        return _getOAuth2ClientCredentialsHeader(requestId, authentication);
      case GRANT_TYPE_IMPLICIT:
        return _getOAuth2ImplicitHeader(requestId, authentication);
      case GRANT_TYPE_PASSWORD:
        return _getOAuth2PasswordHeader(requestId, authentication);
    }
  }

  return null;
}

async function _getOAuth2AuthorizationCodeHeader (requestId, authentication) {
  const token = await _getAccessToken(requestId, authentication);
  if (token) {
    return _buildBearerHeader(token);
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

  await _updateOAuth2Token(requestId, results);

  return results ? _buildBearerHeader(results[Q_ACCESS_TOKEN]) : null;
}

async function _getOAuth2ClientCredentialsHeader (requestId, authentication) {
  const token = await _getAccessToken(requestId, authentication);
  if (token) {
    return _buildBearerHeader(token);
  }

  const results = await getAccessTokenClientCredentials(
    authentication.accessTokenUrl,
    authentication.credentialsInBody,
    authentication.clientId,
    authentication.clientSecret,
    authentication.scope
  );

  await _updateOAuth2Token(requestId, results);

  return results ? _buildBearerHeader(results[Q_ACCESS_TOKEN]) : null;
}

async function _getOAuth2ImplicitHeader (requestId, authentication) {
  const token = await _getAccessToken(requestId, authentication);
  if (token) {
    return _buildBearerHeader(token);
  }

  console.log('GET TOKEN IMPLICIT');
  const results = await getAccessTokenImplicit(
    authentication.authorizationUrl,
    authentication.clientId,
    authentication.redirectUrl,
    authentication.scope,
    authentication.state
  );

  await _updateOAuth2Token(requestId, results);

  return results ? _buildBearerHeader(results[Q_ACCESS_TOKEN]) : null;
}

async function _getOAuth2PasswordHeader (requestId, authentication) {
  const token = await _getAccessToken(requestId, authentication);
  if (token) {
    return _buildBearerHeader(token);
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

  await _updateOAuth2Token(requestId, results);

  return results ? _buildBearerHeader(results[Q_ACCESS_TOKEN]) : null;
}

function _buildBearerHeader (accessToken) {
  if (accessToken) {
    return {
      name: 'Authorization',
      value: `Bearer ${accessToken}`
    };
  } else {
    return null;
  }
}

async function _getAccessToken (requestId, authentication) {
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

  if (!isExpired) {
    console.log('TOKEN NOT EXPIRED', token);
    return token.refreshToken || token.accessToken;
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
    authentication.refreshToken,
    authentication.scope
  );

  // ~~~~~~~~~~~~~ //
  // Update the DB //
  // ~~~~~~~~~~~~~ //

  await _updateOAuth2Token(requestId, refreshResults);

  return refreshResults[Q_REFRESH_TOKEN];
}

async function _updateOAuth2Token (requestId, authResults) {
  const token = await models.oAuth2Token.getOrCreateByParentId(requestId);

  const expiresIn = authResults[Q_EXPIRES_IN];
  const expiresAt = expiresIn ? (Date.now() + (expiresIn * 1000)) : null;
  const refreshToken = authResults[Q_REFRESH_TOKEN];
  const accessToken = authResults[Q_ACCESS_TOKEN];

  console.log('UPDATED TOKEN', token, {authResults});

  await models.oAuth2Token.update(token, {
    expiresAt,
    refreshToken,
    accessToken
  });
}
