import { RequestAuthentication } from '../../models/request';
import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../utils/url/querystring';
import * as c from './constants';
import { getOAuthSession, insertAuthKeyIf } from './misc';
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
export const grantImplicit = async (
  _requestId: string,
  implicitUrl: string,
) => {
  const redirectedTo = await window.main.authorizeUserInWindow({
    url: implicitUrl,
    urlSuccessRegex: /(access_token=|id_token=)/,
    urlFailureRegex: /(error=)/,
    sessionId: getOAuthSession(),
  });
  const hash = new URL(redirectedTo).hash.slice(1);
  if (!hash) {
    return {};
  }
  const data = Object.fromEntries(new URLSearchParams(hash));
  const keys = [
    'access_token',
    'id_token',
    'token_type',
    'expires_in',
    'scope',
    'state',
    'error',
    'error_description',
    'error_uri',
  ];
  const results = Object.fromEntries(keys.map(key => [key, data?.[key] !== undefined ? data[key] : null]));
  results.access_token = results.access_token || results.id_token;
  return results;

};
