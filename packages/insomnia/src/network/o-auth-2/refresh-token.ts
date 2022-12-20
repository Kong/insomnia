import { CONTENT_TYPE_FORM_URLENCODED } from '../../common/constants';
import * as models from '../../models/index';
import { invariant } from '../../utils/invariant';
import { setDefaultProtocol } from '../../utils/url/protocol';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import { sendWithSettings } from '../network';
import { insertAuthKeyIf, parseAndFilter } from './misc';

export const refreshAccessToken = async (
  requestId: string,
  accessTokenUrl: string,
  credentialsInBody: boolean,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  scope: string,
  origin: string,
) => {
  const response = await sendWithSettings(requestId, {
    headers: [
      {
        name: 'Content-Type',
        value: 'application/x-www-form-urlencoded',
      },
      {
        name: 'Accept',
        value: 'application/x-www-form-urlencoded, application/json',
      },
      ...(origin ? [{ name: 'Origin', value: origin }] : []),
    ],
    url: setDefaultProtocol(accessTokenUrl),
    method: 'POST',
    body: {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: [
        {
          name: 'grant_type',
          value: 'refresh_token',
        },
        {
          name: 'refresh_token',
          value: refreshToken,
        },
        ...insertAuthKeyIf(scope, 'scope'),
        ...(credentialsInBody ? [{
          name: 'client_id',
          value: clientId,
        }, {
          name: 'client_secret',
          value: clientSecret,
        }] : [getBasicAuthHeader(clientId, clientSecret)]),
      ],
    },
  });
  const statusCode = response.statusCode || 0;
  const bodyBuffer = models.response.getBodyBuffer(response);

  if (statusCode === 401) {
    // If the refresh token was rejected due an unauthorized request, we will
    // return a null access_token to trigger an authentication request to fetch
    // brand new refresh and access tokens.
    return { access_token: null };
  }
  if (statusCode < 200 || statusCode >= 300) {
    if (bodyBuffer && statusCode === 400) {
      const response = parseAndFilter(bodyBuffer.toString(), ['error', 'error_description']);

      // If the refresh token was rejected due an oauth2 invalid_grant error, we will
      // return a null access_token to trigger an authentication request to fetch
      // brand new refresh and access tokens.
      if (response.error === 'invalid_grant') {
        return { access_token: null };
      }
    }

    throw new Error(`[oauth2] Failed to refresh token url=${accessTokenUrl} status=${statusCode}`);
  }

  invariant(bodyBuffer, `[oauth2] No body returned from ${accessTokenUrl}`);
  const obj = parseAndFilter(
    bodyBuffer.toString(),
    [
      'access_token',
      'id_token',
      'refresh_token',
      'expires_in',
      'token_type',
      'scope',
      'error',
      'error_uri',
      'error_description',
    ],
  );
  if (obj.refresh_token !== undefined) {
    obj.refresh_token = refreshToken;
  }
  return obj;
};
