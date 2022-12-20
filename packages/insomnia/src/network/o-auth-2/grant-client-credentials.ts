import { CONTENT_TYPE_FORM_URLENCODED } from '../../common/constants';
import * as models from '../../models/index';
import { RequestAuthentication } from '../../models/request';
import { setDefaultProtocol } from '../../utils/url/protocol';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import { sendWithSettings } from '../network';
import * as c from './constants';
import { insertAuthKeyIf, parseAndFilter } from './misc';

export const grantClientCreds = async (
  requestId: string,
  authentication: Partial<RequestAuthentication>,
) => {
  const {
    accessTokenUrl,
    credentialsInBody,
    clientId,
    clientSecret,
    scope,
    audience,
    resource,
  } = authentication;
  const responsePatch = await sendWithSettings(requestId, {
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
    url: setDefaultProtocol(accessTokenUrl),
    method: 'POST',
    body: {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: [
        {
          name: 'grant_type',
          value: c.GRANT_TYPE_CLIENT_CREDENTIALS,
        },
        ...insertAuthKeyIf(scope, 'scope'),
        ...insertAuthKeyIf(audience, 'audience'),
        ...insertAuthKeyIf(resource, 'resource'),
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
      [c.X_ERROR]: `No body returned from ${accessTokenUrl}`,
      [c.X_RESPONSE_ID]: response._id,
    };
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    return {
      [c.X_ERROR]: `Failed to fetch token url=${accessTokenUrl} status=${response.statusCode}`,
      [c.X_RESPONSE_ID]: response._id,
    };
  }

  const results = parseAndFilter(bodyBuffer.toString('utf8'), [
    'access_token',
    'id_token',
    'refresh_token',
    'token_type',
    'expires_in',
    'scope',
    'audience',
    'resource',
    'error',
    'error_uri',
    'error_description',
  ]);
  results[c.X_RESPONSE_ID] = response._id;
  return results;
};
