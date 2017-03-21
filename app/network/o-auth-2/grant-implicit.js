import * as querystring from '../../common/querystring';
import * as c from './constants';
import {responseToObject, authorizeUserInWindow} from './misc';

export default async function (authorizationUrl, clientId, redirectUri = '', scope = '', state = '') {
  const params = [
    {name: c.Q_RESPONSE_TYPE, value: c.RESPONSE_TYPE_TOKEN},
    {name: c.Q_CLIENT_ID, value: clientId}
  ];

  // Add optional params
  redirectUri && params.push({name: c.Q_REDIRECT_URI, value: redirectUri});
  scope && params.push({name: c.Q_SCOPE, value: scope});
  state && params.push({name: c.Q_STATE, value: state});

  // Add query params to URL
  const qs = querystring.buildFromParams(params);
  const finalUrl = querystring.joinUrl(authorizationUrl, qs);

  const redirectedTo = await authorizeUserInWindow(finalUrl, /(access_token=|error=)/);
  const fragment = redirectedTo.split('#')[1];

  if (fragment) {
    return responseToObject(fragment, [
      c.Q_ACCESS_TOKEN,
      c.Q_TOKEN_TYPE,
      c.Q_EXPIRES_IN,
      c.Q_SCOPE,
      c.Q_STATE,
      c.Q_ERROR,
      c.Q_ERROR_DESCRIPTION,
      c.Q_ERROR_URI
    ]);
  } else {
    // Bad redirect
    return {};
  }
}
