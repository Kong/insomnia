import * as querystring from '../../common/querystring';
import {getBasicAuthHeader} from '../../common/misc';
import * as c from './constants';
import {responseToObject} from './misc';

export default async function (accessTokenUrl, credentialsInBody, clientId, clientSecret, scope = '') {
  const params = [
    {name: c.Q_GRANT_TYPE, value: c.GRANT_TYPE_CLIENT_CREDENTIALS}
  ];

  // Add optional params
  scope && params.push({name: c.Q_SCOPE, value: scope});

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/x-www-form-urlencoded, application/json'
  };

  if (credentialsInBody) {
    params.push({name: c.Q_CLIENT_ID, value: clientId});
    params.push({name: c.Q_CLIENT_SECRET, value: clientSecret});
  } else {
    const {name, value} = getBasicAuthHeader(clientId, clientSecret);
    headers[name] = value;
  }

  const config = {
    method: 'POST',
    body: querystring.buildFromParams(params),
    headers: headers
  };

  const response = await window.fetch(accessTokenUrl, config);
  const body = await response.text();
  const results = responseToObject(body, [
    c.Q_ACCESS_TOKEN,
    c.Q_TOKEN_TYPE,
    c.Q_EXPIRES_IN,
    c.Q_SCOPE,
    c.Q_ERROR,
    c.Q_ERROR_URI,
    c.Q_ERROR_DESCRIPTION
  ]);

  return results;
}
