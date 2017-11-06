import {AUTH_BASIC, AUTH_BEARER, AUTH_OAUTH_2, AUTH_OAUTH_1, AUTH_HAWK} from '../common/constants';
import {getBasicAuthHeader, getBearerAuthHeader} from '../common/misc';
import getOAuth2Token from './o-auth-2/get-token';
import getOAuth1Token from './o-auth-1/get-token';
import * as Hawk from 'hawk';

export async function getAuthHeader (requestId, url, method, authentication) {
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

  if (authentication.type === AUTH_OAUTH_1) {
    const oAuth1Token = await getOAuth1Token(url, method, authentication);
    if (oAuth1Token) {
      return {
        name: 'Authorization',
        value: oAuth1Token.Authorization
      };
    } else {
      return null;
    }
  }

  if (authentication.type === AUTH_HAWK) {
    const {id, key, algorithm} = authentication;

    const header = Hawk.client.header(
      url,
      method,
      {credentials: {id, key, algorithm}}
    );

    return {
      name: 'Authorization',
      value: header.field
    };
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
