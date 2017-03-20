import * as querystring from '../../common/querystring';
import * as c from './constants';
import {responseToObject} from './misc';
import {getBasicAuthHeader} from '../../common/misc';

/**
 * Refresh an OAuth 2.0 access token
 * @param url
 * @param {boolean} useBasicAuth
 * @param {string} clientId
 * @param {string} clientSecret
 * @param refreshToken
 * @param {string} [scope]
 * @returns {Promise.<{}>}
 */
export async function refresh (url,
                               useBasicAuth,
                               clientId,
                               clientSecret,
                               refreshToken,
                               scope = '') {
  const params = [
    {name: c.Q_GRANT_TYPE, value: c.GRANT_TYPE_REFRESH_TOKEN},
    {name: c.Q_REFRESH_TOKEN, value: refreshToken}
  ];

  // Add optional params
  scope && params.push({name: c.Q_SCOPE, value: scope});

  const headers = new window.Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/x-www-form-urlencoded, application/json'
  });

  if (useBasicAuth) {
    const {name, value} = getBasicAuthHeader(clientId, clientSecret);
    headers.set(name, value);
  } else {
    params.push({name: c.Q_CLIENT_ID, value: clientId});
    params.push({name: c.Q_CLIENT_SECRET, value: clientSecret});
  }

  const config = {
    method: 'POST',
    body: querystring.buildFromParams(params),
    headers: headers
  };

  const response = await window.fetch(url, config);
  const body = await response.text();
  const results = responseToObject(body, [
    c.Q_ACCESS_TOKEN,
    c.Q_REFRESH_TOKEN,
    c.Q_EXPIRES_IN,
    c.Q_TOKEN_TYPE,
    c.Q_SCOPE,
    c.Q_ERROR,
    c.Q_ERROR_URI,
    c.Q_ERROR_DESCRIPTION
  ]);

  return results;
}
