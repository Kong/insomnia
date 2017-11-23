// @flow
import {getBasicAuthHeader, setDefaultProtocol} from '../../common/misc';
import * as c from './constants';
import {responseToObject} from './misc';
import {sendWithSettings} from '../network';
import * as models from '../../models/index';

export default async function (
  requestId: string,
  accessTokenUrl: string,
  credentialsInBody: boolean,
  clientId: string,
  clientSecret: string,
  scope: string = ''
): Promise<Object> {
  const params = [
    {name: c.P_GRANT_TYPE, value: c.GRANT_TYPE_CLIENT_CREDENTIALS}
  ];

  // Add optional params
  scope && params.push({name: c.P_SCOPE, value: scope});

  const headers = [
    {name: 'Content-Type', value: 'application/x-www-form-urlencoded'},
    {name: 'Accept', value: 'application/x-www-form-urlencoded, application/json'}
  ];

  if (credentialsInBody) {
    params.push({name: c.P_CLIENT_ID, value: clientId});
    params.push({name: c.P_CLIENT_SECRET, value: clientSecret});
  } else {
    headers.push(getBasicAuthHeader(clientId, clientSecret));
  }

  const url = setDefaultProtocol(accessTokenUrl);

  const response = await sendWithSettings(requestId, {
    headers,
    url,
    method: 'POST',
    body: models.request.newBodyFormUrlEncoded(params)
  });

  const bodyBuffer = models.response.getBodyBuffer(response);
  if (!bodyBuffer) {
    throw new Error(`[oauth2] No body returned from ${url}`);
  }

  const statusCode = response.statusCode || 0;
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`[oauth2] Failed to fetch token url=${url} status=${statusCode}`);
  }

  const results = responseToObject(bodyBuffer.toString('utf8'), [
    c.P_ACCESS_TOKEN,
    c.P_TOKEN_TYPE,
    c.P_EXPIRES_IN,
    c.P_SCOPE,
    c.P_ERROR,
    c.P_ERROR_URI,
    c.P_ERROR_DESCRIPTION
  ]);

  return results;
}
