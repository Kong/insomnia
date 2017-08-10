import {AUTH_BASIC, AUTH_BEARER, AUTH_OAUTH_2} from '../common/constants';
import {getBasicAuthHeader, getBearerAuthHeader} from '../common/misc';
import getOAuth2Token from './o-auth-2/get-token';

export async function getAuthHeader (requestId, authentication) {
  if (authentication.disabled) {
    return null;
  }

  if (authentication.type === AUTH_BASIC) {
    const {username, password} = authentication;
    return getBasicAuthHeader(username, password);
  }

  if (authentication.type === AUTH_BEARER) {
    const {token} = authentication;
    return getBearerAuthHeader(token);
  }

  if (authentication.type === AUTH_OAUTH_2) {
    const oAuth2Token = await getOAuth2Token(requestId, authentication);
    if (oAuth2Token) {
      const token = oAuth2Token.accessToken;
      return _buildBearerHeader(token, authentication.tokenPrefix);
    } else {
      return null;
    }
  }

  return null;
}

function _buildBearerHeader (accessToken, prefix) {
  if (!accessToken) {
    return null;
  }

  const name = 'Authorization';
  const value = `${prefix || 'Bearer'} ${accessToken}`;

  return {name, value};
}
