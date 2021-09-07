import { setDefaultProtocol } from 'insomnia-url';

import * as models from '../../models/index';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import * as network from '../network';
import * as c from './constants';
import { responseToObject } from './misc';

export default async function(
  requestId: string,
  accessTokenUrl: string,
  credentialsInBody: boolean,
  clientId: string,
  clientSecret: string,
  username: string,
  password: string,
  scope = '',
  audience = '',
): Promise<Record<string, any>> {
  const params = [
    {
      name: c.P_GRANT_TYPE,
      value: c.GRANT_TYPE_PASSWORD,
    },
    {
      name: c.P_USERNAME,
      value: username,
    },
    {
      name: c.P_PASSWORD,
      value: password,
    },
  ];
  // Add optional params
  scope &&
    params.push({
      name: c.P_SCOPE,
      value: scope,
    });
  audience &&
    params.push({
      name: c.P_AUDIENCE,
      value: audience,
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
  const responsePatch = await network.sendWithSettings(requestId, {
    url,
    headers,
    method: 'POST',
    body: models.request.newBodyFormUrlEncoded(params),
  });
  const response = await models.response.create(responsePatch);
  // @ts-expect-error -- TSCONVERSION
  const bodyBuffer = models.response.getBodyBuffer(response);

  if (!bodyBuffer) {
    return {
      [c.X_ERROR]: `No body returned from ${url}`,
      [c.X_RESPONSE_ID]: response._id,
    };
  }

  // @ts-expect-error -- TSCONVERSION
  const statusCode = response.statusCode || 0;

  if (statusCode < 200 || statusCode >= 300) {
    return {
      [c.X_ERROR]: `Failed to fetch token url=${url} status=${statusCode}`,
      [c.X_RESPONSE_ID]: response._id,
    };
  }

  const results = responseToObject(bodyBuffer.toString(), [
    c.P_ACCESS_TOKEN,
    c.P_ID_TOKEN,
    c.P_TOKEN_TYPE,
    c.P_EXPIRES_IN,
    c.P_REFRESH_TOKEN,
    c.P_SCOPE,
    c.P_AUDIENCE,
    c.P_ERROR,
    c.P_ERROR_URI,
    c.P_ERROR_DESCRIPTION,
  ]);
  results[c.X_RESPONSE_ID] = response._id;
  return results;
}
