import { RequestAuthentication } from '../../models/request';
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
    { name: 'grant_type', value: 'client_credentials' },
    ...insertAuthKeyIf(scope, 'scope'),
    ...insertAuthKeyIf(audience, 'audience'),
    ...insertAuthKeyIf(resource, 'resource'),
    ...(credentialsInBody ? [{
      name: 'client_id',
      value: clientId,
    }, {
      name: 'client_secret',
      value: clientSecret,
    }] : []),
  ];
};
