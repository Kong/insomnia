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

  return {
    ...data,
    access_token: data.access_token || data._id_token,
  };

};
