import { buildQueryStringFromParams, joinUrlAndQueryString } from 'insomnia-url';

import * as c from './constants';
import { authorizeUserInWindow, responseToObject } from './misc';

export default async function(
  _requestId: string,
  authorizationUrl: string,
  clientId: string,
  responseType: string = c.RESPONSE_TYPE_TOKEN,
  redirectUri = '',
  scope = '',
  state = '',
  audience = '',
): Promise<Record<string, any>> {
  const params = [
    {
      name: c.P_RESPONSE_TYPE,
      value: responseType,
    },
    {
      name: c.P_CLIENT_ID,
      value: clientId,
    },
  ];

  // Add optional params
  if (
    responseType === c.RESPONSE_TYPE_ID_TOKEN_TOKEN ||
    responseType === c.RESPONSE_TYPE_ID_TOKEN
  ) {
    const nonce = Math.floor(Math.random() * 9999999999999) + 1;
    params.push({
      name: c.P_NONCE,
      // @ts-expect-error -- TSCONVERSION
      value: nonce,
    });
  }

  redirectUri &&
    params.push({
      name: c.P_REDIRECT_URI,
      value: redirectUri,
    });
  scope &&
    params.push({
      name: c.P_SCOPE,
      value: scope,
    });
  state &&
    params.push({
      name: c.P_STATE,
      value: state,
    });
  audience &&
    params.push({
      name: c.P_AUDIENCE,
      value: audience,
    });
  // Add query params to URL
  const qs = buildQueryStringFromParams(params);
  const finalUrl = joinUrlAndQueryString(authorizationUrl, qs);
  const redirectedTo = await authorizeUserInWindow(
    finalUrl,
    /(access_token=|id_token=)/,
    /(error=)/,
  );
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
}
