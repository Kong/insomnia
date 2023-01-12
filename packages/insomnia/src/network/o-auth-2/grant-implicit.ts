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
  const params = [
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
      value: Math.floor(Math.random() * 9999999999999) + 1,
    }] : []),
  ];

  // Add query params to URL
  const qs = buildQueryStringFromParams(params);
  const finalUrl = joinUrlAndQueryString(authorizationUrl, qs);
  const urlSuccessRegex = /(access_token=|id_token=)/;
  const urlFailureRegex = /(error=)/;
  const sessionId = getOAuthSession();
  const redirectedTo = await window.main.authorizeUserInWindow({ url: finalUrl, urlSuccessRegex, urlFailureRegex, sessionId });

  const fragment = redirectedTo.split('#')[1];

  if (fragment) {
    const results = responseToObject(fragment, [
      c.P_ACCESS_TOKEN,
      c.P_ID_TOKEN,
      c.P_TOKEN_TYPE,
      c.P_EXPIRES_IN,
      c.P_SCOPE,
      c.P_STATE,
      c.P_ERROR,
      c.P_ERROR_DESCRIPTION,
      c.P_ERROR_URI,
    ]);
    results[c.P_ACCESS_TOKEN] = results[c.P_ACCESS_TOKEN] || results[c.P_ID_TOKEN];
    return results;
  } else {
    // Bad redirect
    return {};
  }
};
