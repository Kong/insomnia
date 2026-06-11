import * as Hawk from 'hawk';
import type { AuthTypeOAuth2, RequestAuthentication, RequestHeader } from 'insomnia-data';

import type { RenderedRequest } from '~/templating/types';

import { COOKIE, HEADER } from '../../network/api-key/constants';
import { getBasicAuthHeader } from '../../network/basic-auth/get-header';
import { getBearerAuthHeader } from '../../network/bearer-auth/get-header';
import getOAuth1Token from './o-auth-1/get-token';
import { getOAuth2Token } from './o-auth-2/get-token';

const buildBearerHeader = (accessToken: string, prefix?: string): RequestHeader | undefined => {
  if (!accessToken) {
    return;
  }

  return {
    name: 'Authorization',
    value: prefix === 'NO_PREFIX' ? accessToken : `${prefix || 'Bearer'} ${accessToken}`,
  };
};

export async function getAuthHeader(renderedRequest: RenderedRequest, url: string): Promise<RequestHeader | undefined> {
  const { method, body } = renderedRequest;
  const authentication = renderedRequest.authentication as RequestAuthentication;

  const requestId = renderedRequest._id;

  if (authentication.disabled) {
    return;
  }

  if (authentication.type === 'apikey' && authentication.addTo === HEADER) {
    const { key, value } = authentication;

    if (!key || !value) {
      return;
    }

    return {
      name: key,
      value,
    };
  }

  if (authentication.type === 'apikey' && authentication.addTo === COOKIE) {
    const { key, value } = authentication;
    if (!key || !value) {
      return undefined;
    }
    return {
      name: 'Cookie',
      value: `${key}=${value}`,
    };
  }

  if (authentication.type === 'basic') {
    const { username, password, useISO88591 } = authentication;
    const encoding = useISO88591 ? 'latin1' : 'utf8';
    return getBasicAuthHeader(username, password, encoding);
  }

  if (authentication.type === 'bearer' && authentication.token) {
    const { token, prefix } = authentication;
    return getBearerAuthHeader(token, prefix);
  }

  if (authentication.type === 'oauth2') {
    try {
      // HACK: GraphQL requests use a child request to fetch the schema with an
      // ID of "{{request_id}}.graphql". Here we are removing the .graphql suffix and
      // pretending we are fetching a token for the original request. This makes sure
      // the same tokens are used for schema fetching. See issue #835 on GitHub.
      const tokenId = requestId.match(/\.graphql$/) ? requestId.replace(/\.graphql$/, '') : requestId;
      const oAuth2Token = await getOAuth2Token(tokenId, authentication as AuthTypeOAuth2);

      if (oAuth2Token) {
        return buildBearerHeader(oAuth2Token.accessToken, authentication.tokenPrefix);
      }

      return;
    } catch (err) {
      console.log('[oauth2] Failed to get token', err);
      return;
    }
  }

  if (authentication.type === 'oauth1') {
    const oAuth1Token = await getOAuth1Token(url, method, authentication, body);

    if (oAuth1Token) {
      return {
        name: 'Authorization',
        value: oAuth1Token.Authorization,
      };
    }

    return;
  }

  if (authentication.type === 'hawk') {
    const headerOptions = {
      credentials: {
        id: authentication.id,
        key: authentication.key,
        algorithm: authentication.algorithm,
      },
      ext: authentication.ext,
    };

    if (!authentication.validatePayload) {
      return {
        name: 'Authorization',
        value: Hawk.client.header(url, method, headerOptions).header,
      };
    }
    return {
      name: 'Authorization',
      value: Hawk.client.header(url, method, {
        ...headerOptions,
        payload: renderedRequest.body.text,
        contentType: renderedRequest.body.mimeType || undefined,
      }).header,
    };
  }

  if (authentication.type === 'asap') {
    let parsedAdditionalClaims;
    try {
      parsedAdditionalClaims = JSON.parse(authentication.additionalClaims || '{}');
    } catch (err) {
      throw new Error(`Unable to parse additional-claims: ${err}`);
    }

    if (parsedAdditionalClaims && typeof parsedAdditionalClaims !== 'object') {
      throw new Error(`additional-claims must be an object received: '${typeof parsedAdditionalClaims}' instead`);
    }

    const generator = (await import('httplease-asap')).createAuthHeaderGenerator({
      privateKey: authentication.privateKey,
      issuer: authentication.issuer,
      keyId: authentication.keyId,
      audience: authentication.audience,
      subject: authentication.subject,
      additionalClaims: parsedAdditionalClaims,
      tokenExpiryMs: 10 * 60 * 1000,
      tokenMaxAgeMs: 9 * 60 * 1000,
    });
    return {
      name: 'Authorization',
      value: generator(),
    };
  }

  return;
}
