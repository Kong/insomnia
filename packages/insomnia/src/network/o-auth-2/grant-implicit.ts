import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../utils/url/querystring';
import * as c from './constants';
import { AuthParam, getOAuthSession, responseToObject } from './misc';

export const grantImplicit = async (
  _requestId: string,
  authorizationUrl: string,
  clientId: string,
  responseType: string = c.RESPONSE_TYPE_TOKEN,
  redirectUri = '',
  scope = '',
  state = '',
  audience = '',
) => {
  const hasNonce = responseType === c.RESPONSE_TYPE_ID_TOKEN_TOKEN || responseType === c.RESPONSE_TYPE_ID_TOKEN;
  // Add query params to URL
  const params: AuthParam[] = [
    {
      name: 'response_type',
      value: responseType,
    },
    {
      name: 'client_id',
      value: clientId,
    },
    ...(redirectUri ? [{
      name: 'redirect_uri',
      value: redirectUri,
    }] : []),
    ...(scope ? [{
      name: 'scope',
      value: scope,
    }] : []),
    ...(state ? [{
      name: 'state',
      value: state,
    }] : []),
    ...(audience ? [{
      name: 'audience',
      value: audience,
    }] : []),
    ...(audience ? [{
      name: 'audience',
      value: audience,
    }] : []),
    ...(hasNonce ? [{
      name: 'nonce',
      value: Math.floor(Math.random() * 9999999999999) + 1 + '',
    }] : []),
  ];
  const qs = buildQueryStringFromParams(params);
  const finalUrl = joinUrlAndQueryString(authorizationUrl, qs);
  const urlSuccessRegex = /(access_token=|id_token=)/;
  const urlFailureRegex = /(error=)/;
  const sessionId = getOAuthSession();
  const redirectedTo = await window.main.authorizeUserInWindow({ url: finalUrl, urlSuccessRegex, urlFailureRegex, sessionId });

  const fragment = redirectedTo.split('#')[1];

  if (fragment) {
    const results = responseToObject(fragment, [
      'access_token',
      'id_token',
      'token_type',
      'expires_in',
      'scope',
      'state',
      'error',
      'error_description',
      'error_uri',
    ]);
    results.access_token = results.access_token || results.id_token;
    return results;
  } else {
    // Bad redirect
    return {};
  }
};
