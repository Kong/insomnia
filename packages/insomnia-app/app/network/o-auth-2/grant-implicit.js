// @flow
import * as c from './constants';
import {buildQueryStringFromParams, joinUrlAndQueryString} from 'insomnia-url';
import {responseToObject, authorizeUserInWindow} from './misc';

export default async function (
  requestId: string,
  authorizationUrl: string,
  clientId: string,
  responseType: string = c.RESPONSE_TYPE_TOKEN,
  redirectUri: string = '',
  scope: string = '',
  state: string = ''
): Promise<Object> {
  const params = [
    {name: c.P_CLIENT_ID, value: responseType},
    {name: c.P_CLIENT_ID, value: clientId}
  ];
  const RESPONSE_NONCE: string = ((Math.floor(Math.random() * 9999999999999) + 1): any);

  // Add optional params
  redirectUri && params.push({name: c.P_REDIRECT_URI, value: redirectUri});
  scope && params.push({name: c.P_SCOPE, value: scope});
  state && params.push({name: c.P_STATE, value: state});
  responseType === c.RESPONSE_TYPE_BOTH && params.push({name: c.P_NONCE, value: RESPONSE_NONCE});

  // Add query params to URL
  const qs = buildQueryStringFromParams(params);
  const finalUrl = joinUrlAndQueryString(authorizationUrl, qs);

  const redirectedTo = await authorizeUserInWindow(finalUrl, /(access_token=)/, /(error=)/);
  const fragment = redirectedTo.split('#')[1];

  if (fragment) {
    return responseToObject(fragment, [
      c.P_ACCESS_TOKEN,
      c.P_TOKEN_TYPE,
      c.P_EXPIRES_IN,
      c.P_NONCE,
      c.P_SCOPE,
      c.P_STATE,
      c.P_ERROR,
      c.P_ERROR_DESCRIPTION,
      c.P_ERROR_URI
    ]);
  } else {
    // Bad redirect
    return {};
  }
}
