import {AUTH_BASIC, AUTH_BEARER, AUTH_OAUTH_2, AUTH_HAWK, AUTH_ASAP} from '../common/constants';
import {getBasicAuthHeader, getBearerAuthHeader} from '../common/misc';
import getOAuth2Token from './o-auth-2/get-token';
import * as Hawk from 'hawk';
import jwtAuthentication from 'jwt-authentication';

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

  if (authentication.type === AUTH_ASAP) {
    const {issuer, subject, audience, keyId, privateKey} = authentication;
    const generator = jwtAuthentication.client.create();
    const claims = {
      iss: issuer,
      sub: subject,
      aud: audience
    };
    const options = {
      privateKey,
      kid: keyId
    };

    return new Promise((resolve, reject) => {
      generator.generateAuthorizationHeader(claims, options, (error, headerValue) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            name: 'Authorization',
            value: headerValue
          });
        }
      });
    });
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
