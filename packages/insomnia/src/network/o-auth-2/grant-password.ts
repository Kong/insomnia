import * as models from '../../models/index';
import { RequestAuthentication } from '../../models/request';
import { setDefaultProtocol } from '../../utils/url/protocol';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import * as network from '../network';
import * as c from './constants';
import { insertAuthKeyIf, parseAndFilter } from './misc';

export const grantPassword = async (
  requestId: string,
  authentication: Partial<RequestAuthentication>,
) => {
  const {
    accessTokenUrl,
    credentialsInBody,
    clientId,
    clientSecret,
    username,
    password,
    scope,
    audience,
  } = authentication;
  const responsePatch = await network.sendWithSettings(requestId, {
    url: setDefaultProtocol(accessTokenUrl),
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
  const bodyBuffer = models.response.getBodyBuffer(response);

  if (!bodyBuffer) {
    return {
      [c.X_ERROR]: `No body returned from ${setDefaultProtocol(accessTokenUrl)}`,
      [c.X_RESPONSE_ID]: response._id,
    };
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    return {
      [c.X_ERROR]: `Failed to fetch token url=${setDefaultProtocol(accessTokenUrl)} status=${response.statusCode}`,
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
