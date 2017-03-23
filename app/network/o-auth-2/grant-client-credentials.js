import * as querystring from '../../common/querystring';
import {getBasicAuthHeader} from '../../common/misc';
import * as c from './constants';
import {responseToObject} from './misc';

export default async function (accessTokenUrl, credentialsInBody, clientId, clientSecret, scope = '') {
  const params = [
    {name: c.P_GRANT_TYPE, value: c.GRANT_TYPE_CLIENT_CREDENTIALS}
  ];

  // Add optional params
  scope && params.push({name: c.P_SCOPE, value: scope});

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/x-www-form-urlencoded, application/json'
  };

  if (credentialsInBody) {
    params.push({name: c.P_CLIENT_ID, value: clientId});
    params.push({name: c.P_CLIENT_SECRET, value: clientSecret});
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
    c.P_ACCESS_TOKEN,
    c.P_TOKEN_TYPE,
    c.P_EXPIRES_IN,
    c.P_SCOPE,
    c.P_ERROR,
    c.P_ERROR_URI,
    c.P_ERROR_DESCRIPTION
  ]);

  return results;
}
