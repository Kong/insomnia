import { setDefaultProtocol } from 'insomnia-url';

import * as models from '../../models/index';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import { sendWithSettings } from '../network';
import * as c from './constants';
import { responseToObject } from './misc';

export default async function(
  requestId: string,
  accessTokenUrl: string,
  credentialsInBody: boolean,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  scope: string,
): Promise<Record<string, any>> {
  const params = [
    {
      name: c.P_GRANT_TYPE,
      value: c.GRANT_TYPE_REFRESH,
    },
    {
      name: c.P_REFRESH_TOKEN,
      value: refreshToken,
    },
  ];
  // Add optional params
  scope &&
    params.push({
      name: c.P_SCOPE,
      value: scope,
    });
  const headers = [
    {
      name: 'Content-Type',
      value: 'application/x-www-form-urlencoded',
    },
    {
      name: 'Accept',
      value: 'application/x-www-form-urlencoded, application/json',
    },
  ];

  if (credentialsInBody) {
    params.push({
      name: c.P_CLIENT_ID,
      value: clientId,
    });
    params.push({
      name: c.P_CLIENT_SECRET,
      value: clientSecret,
    });
  } else {
    headers.push(getBasicAuthHeader(clientId, clientSecret));
  }

  const url = setDefaultProtocol(accessTokenUrl);
  const response = await sendWithSettings(requestId, {
    headers,
    url,
    method: 'POST',
    body: models.request.newBodyFormUrlEncoded(params),
  });
  const statusCode = response.statusCode || 0;
  const bodyBuffer = models.response.getBodyBuffer(response);

  if (statusCode === 401) {
    // If the refresh token was rejected due an unauthorized request, we will
    // return a null access_token to trigger an authentication request to fetch
    // brand new refresh and access tokens.
    return responseToObject(null, [c.P_ACCESS_TOKEN]);
  } else if (statusCode < 200 || statusCode >= 300) {
    if (bodyBuffer && statusCode === 400) {
      const response = responseToObject(bodyBuffer.toString(), [c.P_ERROR, c.P_ERROR_DESCRIPTION]);

      // If the refresh token was rejected due an oauth2 invalid_grant error, we will
      // return a null access_token to trigger an authentication request to fetch
      // brand new refresh and access tokens.
      if (response[c.P_ERROR] === 'invalid_grant') {
        return responseToObject(null, [c.P_ACCESS_TOKEN]);
      }
    }

    throw new Error(`[oauth2] Failed to refresh token url=${url} status=${statusCode}`);
  }

  if (!bodyBuffer) {
    throw new Error(`[oauth2] No body returned from ${url}`);
  }

  return responseToObject(
    bodyBuffer.toString(),
    [
      c.P_ACCESS_TOKEN,
      c.P_ID_TOKEN,
      c.P_REFRESH_TOKEN,
      c.P_EXPIRES_IN,
      c.P_TOKEN_TYPE,
      c.P_SCOPE,
      c.P_ERROR,
      c.P_ERROR_URI,
      c.P_ERROR_DESCRIPTION,
    ],
    {
      // Refresh token is optional, so we'll default it to the existing value
      [c.P_REFRESH_TOKEN]: refreshToken,
    },
  );
}
