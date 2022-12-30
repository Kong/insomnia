import { CONTENT_TYPE_FORM_URLENCODED } from '../../common/constants';
import * as models from '../../models/index';
import { RequestAuthentication } from '../../models/request';
import { setDefaultProtocol } from '../../utils/url/protocol';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import { sendWithSettings } from '../network';
import * as c from './constants';
import { insertAuthKeyIf, tryToParse } from './misc';

export const grantClientCreds = async (
  authentication: Partial<RequestAuthentication>,
) => {
  const {
    credentialsInBody,
    clientId,
    clientSecret,
    scope,
    audience,
    resource,
  } = authentication;
  return [
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
  ];

};
