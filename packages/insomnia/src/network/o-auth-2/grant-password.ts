import * as models from '../../models/index';
import { setDefaultProtocol } from '../../utils/url/protocol';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import * as network from '../network';
import * as c from './constants';
import { insertAuthKeyIf, parseAndFilter } from './misc';

export const grantPassword = async (
  requestId: string,
  accessTokenUrl: string,
  credentialsInBody: boolean,
  clientId: string,
  clientSecret: string,
  username: string,
  password: string,
  scope = '',
  audience = '',
) => {
  const url = setDefaultProtocol(accessTokenUrl);
  const responsePatch = await network.sendWithSettings(requestId, {
    url,
    headers: [
      {
        name: 'Content-Type',
        value: 'application/x-www-form-urlencoded',
      },
      {
        name: 'Accept',
        value: 'application/x-www-form-urlencoded, application/json',
      },
    ],
    method: 'POST',
    body: {
      mimeType: 'application/x-www-form-urlencoded',
      params: [
        {
          name: 'grant_type',
          value: 'password',
        },
        {
          name: 'username',
          value: username,
        },
        {
          name: 'password',
          value: password,
        },
        ...insertAuthKeyIf(scope, 'scope'),
        ...insertAuthKeyIf(audience, 'audience'),
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

  const results = parseAndFilter(bodyBuffer.toString(), [
    'access_token',
    'id_token',
    'token_type',
    'expires_in',
    'refresh_token',
    'scope',
    'audience',
    'error',
    'error_uri',
    'error_description',
  ]);
  results[c.X_RESPONSE_ID] = response._id;
  return results;
};
