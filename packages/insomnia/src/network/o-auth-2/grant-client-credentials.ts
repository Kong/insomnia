import { RequestAuthentication } from '../../models/request';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import * as c from './constants';
import { insertAuthKeyIf } from './misc';

export const grantClientCreds = async ({
  credentialsInBody,
  clientId,
  clientSecret,
  scope,
  audience,
  resource,
}: Partial<RequestAuthentication>) => {
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
