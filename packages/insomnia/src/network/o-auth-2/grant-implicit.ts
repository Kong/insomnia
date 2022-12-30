import { RequestAuthentication } from '../../models/request';
import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../utils/url/querystring';
import * as c from './constants';
import { insertAuthKeyIf } from './misc';
export const grantImplicitUrl = ({
  authorizationUrl,
  responseType,
  clientId,
  redirectUri,
  scope,
  state,
  audience }: Partial<RequestAuthentication>) => {
  const hasNonce = responseType === c.RESPONSE_TYPE_ID_TOKEN_TOKEN || responseType === c.RESPONSE_TYPE_ID_TOKEN;
  // Add query params to URL
  return joinUrlAndQueryString(authorizationUrl, buildQueryStringFromParams([
    {
      name: 'response_type',
      value: responseType,
    },
    {
      name: 'client_id',
      value: clientId,
    },
    ...insertAuthKeyIf(redirectUri, 'redirect_uri'),
    ...insertAuthKeyIf(scope, 'scope'),
    ...insertAuthKeyIf(state, 'state'),
    ...insertAuthKeyIf(audience, 'audience'),
    ...(hasNonce ? [{
      name: 'nonce',
      value: Math.floor(Math.random() * 9999999999999) + 1 + '',
    }] : []),
  ]));
};
