import {parse as urlParse} from 'url';
import * as querystring from '../../common/querystring';
import * as c from './constants';
import {responseToObject, authorizeUserInWindow} from './misc';
import {getBasicAuthHeader} from '../../common/misc';

export default async function (authorizeUrl,
                               accessTokenUrl,
                               credentialsInBody,
                               clientId,
                               clientSecret,
                               redirectUri = '',
                               scope = '',
                               state = '') {
  const authorizeResults = await _authorize(
    authorizeUrl,
    clientId,
    redirectUri,
    scope,
    state
  );

  // TODO: Handle errors

  const tokenResults = await _getToken(
    accessTokenUrl,
    credentialsInBody,
    clientId,
    clientSecret,
    authorizeResults[c.P_CODE],
    redirectUri,
    state
  );

  return tokenResults;
}

async function _authorize (url, clientId, redirectUri = '', scope = '', state = '') {
  const params = [
    {name: c.P_RESPONSE_TYPE, value: c.RESPONSE_TYPE_CODE},
    {name: c.P_CLIENT_ID, value: clientId}
  ];

  // Add optional params
  redirectUri && params.push({name: c.P_REDIRECT_URI, value: redirectUri});
  scope && params.push({name: c.P_SCOPE, value: scope});
  state && params.push({name: c.P_STATE, value: state});

  // Add query params to URL
  const qs = querystring.buildFromParams(params);
  const finalUrl = querystring.joinUrl(url, qs);

  const redirectedTo = await authorizeUserInWindow(finalUrl, /(code=|error=)/);

  const {query} = urlParse(redirectedTo);
  return responseToObject(query, [
    c.P_CODE,
    c.P_STATE,
    c.P_ERROR,
    c.P_ERROR_DESCRIPTION,
    c.P_ERROR_URI
  ]);
}

async function _getToken (url, credentialsInBody, clientId, clientSecret, code, redirectUri = '', state = '') {
  const params = [
    {name: c.P_GRANT_TYPE, value: c.GRANT_TYPE_AUTHORIZATION_CODE},
    {name: c.P_CODE, value: code}
  ];

  // Add optional params
  redirectUri && params.push({name: c.P_REDIRECT_URI, value: redirectUri});
  state && params.push({name: c.P_STATE, value: state});

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

  const response = await window.fetch(url, config);
  const body = await response.text();
  const results = responseToObject(body, [
    c.P_ACCESS_TOKEN,
    c.P_REFRESH_TOKEN,
    c.P_EXPIRES_IN,
    c.P_TOKEN_TYPE,
    c.P_SCOPE,
    c.P_ERROR,
    c.P_ERROR_URI,
    c.P_ERROR_DESCRIPTION
  ]);

  return results;
}
