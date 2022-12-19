import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../utils/url/querystring';
import * as c from './constants';
import { getOAuthSession, responseToObject } from './misc';

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
  const qs = buildQueryStringFromParams([
    {
      name: c.P_RESPONSE_TYPE,
      value: responseType,
    },
    {
      name: c.P_CLIENT_ID,
      value: clientId,
    },
    ...(redirectUri ? [{
      name: c.P_REDIRECT_URI,
      value: redirectUri,
    }] : []),
    ...(scope ? [{
      name: c.P_SCOPE,
      value: scope,
    }] : []),
    ...(state ? [{
      name: c.P_STATE,
      value: state,
    }] : []),
    ...(audience ? [{
      name: c.P_AUDIENCE,
      value: audience,
    }] : []),
    ...(audience ? [{
      name: c.P_AUDIENCE,
      value: audience,
    }] : []),
    ...(hasNonce ? [{
      name: c.P_NONCE,
      value: Math.floor(Math.random() * 9999999999999) + 1 + '',
    }] : []),
  ]);
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
