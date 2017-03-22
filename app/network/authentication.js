import {AUTH_BASIC, AUTH_OAUTH_2} from '../common/constants';
import getAccessTokenAC from './o-auth-2/grant-authorization-code';
import getAccessTokenCC from './o-auth-2/grant-client-credentials';
import getAccessTokenP from './o-auth-2/grant-password';
import getAccessTokenI from './o-auth-2/grant-implicit';
import {GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_IMPLICIT, GRANT_TYPE_PASSWORD, GRANT_TYPE_CLIENT_CREDENTIALS} from './o-auth-2/constants';
import {getBasicAuthHeader} from '../common/misc';

export async function getAuthHeader (authentication) {
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
        return _getOAuth2AuthorizationCodeHeader(authentication);
      case GRANT_TYPE_CLIENT_CREDENTIALS:
        return _getOAuth2ClientCredentialsHeader(authentication);
      case GRANT_TYPE_IMPLICIT:
        return _getOAuth2ImplicitHeader(authentication);
      case GRANT_TYPE_PASSWORD:
        return _getOAuth2PasswordHeader(authentication);
    }
  }

  return null;
}

async function _getOAuth2AuthorizationCodeHeader (authentication) {
  const results = await getAccessTokenAC(
    authentication.authorizationUrl,
    authentication.accessTokenUrl,
    authentication.credentialsInBody,
    authentication.clientId,
    authentication.clientSecret,
    authentication.redirectUrl,
    authentication.scope,
    authentication.state
  );

  return results ? _buildBearerHeader(results.access_token) : null;
}

async function _getOAuth2ClientCredentialsHeader (authentication) {
  const results = await getAccessTokenCC(
    authentication.accessTokenUrl,
    authentication.credentialsInBody,
    authentication.clientId,
    authentication.clientSecret,
    authentication.scope
  );

  return results ? _buildBearerHeader(results.access_token) : null;
}

async function _getOAuth2ImplicitHeader (authentication) {
  const results = await getAccessTokenI(
    authentication.authorizationUrl,
    authentication.clientId,
    authentication.redirectUrl,
    authentication.scope,
    authentication.state
  );

  return results ? _buildBearerHeader(results.access_token) : null;
}

async function _getOAuth2PasswordHeader (authentication) {
  const results = await getAccessTokenP(
    authentication.accessTokenUrl,
    authentication.credentialsInBody,
    authentication.clientId,
    authentication.clientSecret,
    authentication.username,
    authentication.password,
    authentication.scope
  );

  return results ? _buildBearerHeader(results.access_token) : null;
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
