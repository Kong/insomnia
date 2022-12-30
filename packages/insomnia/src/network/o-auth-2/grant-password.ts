import { RequestAuthentication } from '../../models/request';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import { insertAuthKeyIf } from './misc';

export const grantPassword = async (
  authentication: Partial<RequestAuthentication>,
) => {
  const {
    credentialsInBody,
    clientId,
    clientSecret,
    username,
    password,
    scope,
    audience,
  } = authentication;
  return [
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
  ];

};
