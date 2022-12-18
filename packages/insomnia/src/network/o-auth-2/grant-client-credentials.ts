import { CONTENT_TYPE_FORM_URLENCODED } from '../../common/constants';
import * as models from '../../models/index';
import { setDefaultProtocol } from '../../utils/url/protocol';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import { sendWithSettings } from '../network';
import * as c from './constants';
import { responseToObject } from './misc';

export const grantClientCreds = async (
  requestId: string,
  accessTokenUrl: string,
  credentialsInBody: boolean,
  clientId: string,
  clientSecret: string,
  scope = '',
  audience = '',
  resource = '',
) => {
  const url = setDefaultProtocol(accessTokenUrl);
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
    url,
    method: 'POST',
    body: {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: [
        {
          name: c.P_GRANT_TYPE,
          value: c.GRANT_TYPE_CLIENT_CREDENTIALS,
        },
        ...(scope ? [{
          name: c.P_SCOPE,
          value: scope,
        }] : []),
        ...(audience ? [{
          name: c.P_AUDIENCE,
          value: audience,
        }] : []),
        ...(resource ? [{
          name: c.P_RESOURCE,
          value: resource,
        }] : []),
        ...(credentialsInBody ? [{
          name: c.P_CLIENT_ID,
          value: clientId,
        }, {
          name: c.P_CLIENT_SECRET,
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

  const results = responseToObject(bodyBuffer.toString('utf8'), [
    c.P_ACCESS_TOKEN,
    c.P_ID_TOKEN,
    c.P_REFRESH_TOKEN,
    c.P_TOKEN_TYPE,
    c.P_EXPIRES_IN,
    c.P_SCOPE,
    c.P_AUDIENCE,
    c.P_RESOURCE,
    c.P_ERROR,
    c.P_ERROR_URI,
    c.P_ERROR_DESCRIPTION,
  ]);
  results[c.X_RESPONSE_ID] = response._id;
  return results;
};
