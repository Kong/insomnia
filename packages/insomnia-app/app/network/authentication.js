// @flow
import {
  AUTH_ASAP,
  AUTH_BASIC,
  AUTH_BEARER,
  AUTH_HAWK,
  AUTH_OAUTH_1,
  AUTH_OAUTH_2
} from '../common/constants';
import getOAuth2Token from './o-auth-2/get-token';
import getOAuth1Token from './o-auth-1/get-token';
import * as Hawk from 'hawk';
import jwtAuthentication from 'jwt-authentication';
import type { RequestAuthentication } from '../models/request';
import { getBasicAuthHeader } from './basic-auth/get-header';
import { getBearerAuthHeader } from './bearer-auth/get-header';

type Header = {
  name: string,
  value: string
};

export async function getAuthHeader(
  requestId: string,
  url: string,
  method: string,
  authentication: RequestAuthentication
): Promise<Header | null> {
  if (authentication.disabled) {
    return null;
  }

  if (authentication.type === AUTH_BASIC) {
    const { username, password } = authentication;
    return getBasicAuthHeader(username, password);
  }

  if (authentication.type === AUTH_BEARER) {
    const { token, prefix } = authentication;
    return getBearerAuthHeader(token, prefix);
  }

  if (authentication.type === AUTH_OAUTH_2) {
    // HACK: GraphQL requests use a child request to fetch the schema with an
    // ID of "{{request_id}}.graphql". Here we are removing the .graphql suffix and
    // pretending we are fetching a token for the original request. This makes sure
    // the same tokens are used for schema fetching. See issue #835 on GitHub.
    const tokenId = requestId.match(/\.graphql$/)
      ? requestId.replace(/\.graphql$/, '')
      : requestId;

    const oAuth2Token = await getOAuth2Token(tokenId, authentication);
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
    const { id, key, algorithm } = authentication;
    const header = Hawk.client.header(url, method, {
      credentials: { id, key, algorithm }
    });
    return {
      name: 'Authorization',
      value: header.field
    };
  }

  if (authentication.type === AUTH_ASAP) {
    const {
      issuer,
      subject,
      audience,
      keyId,
      additionalClaims,
      privateKey
    } = authentication;

    const generator = jwtAuthentication.client.create();
    let claims = { iss: issuer, sub: subject, aud: audience };

    let parsedAdditionalClaims;

    try {
      parsedAdditionalClaims = JSON.parse(additionalClaims || '{}');
    } catch (err) {
      throw new Error(`Unable to parse additional-claims: ${err}`);
    }

    if (parsedAdditionalClaims) {
      if (typeof parsedAdditionalClaims !== 'object') {
        throw new Error(
          `additional-claims must be an object received: '${typeof parsedAdditionalClaims}' instead`
        );
      }

      claims = Object.assign(parsedAdditionalClaims, claims);
    }

    const options = {
      privateKey,
      kid: keyId
    };

    return new Promise((resolve, reject) => {
      generator.generateAuthorizationHeader(
        claims,
        options,
        (error, headerValue) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              name: 'Authorization',
              value: headerValue
            });
          }
        }
      );
    });
  }

  return null;
}

function _buildBearerHeader(accessToken, prefix) {
  if (!accessToken) {
    return null;
  }

  const name = 'Authorization';
  const value = `${prefix || 'Bearer'} ${accessToken}`;

  return { name, value };
}
