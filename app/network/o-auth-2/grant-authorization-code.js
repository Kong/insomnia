import {parse as urlParse} from 'url';
import * as querystring from '../../common/querystring';
import * as c from './constants';
import {responseToObject, authorizeUserInWindow} from './misc';
import {getBasicAuthHeader} from '../../common/misc';

export default async function (authorizeUrl, accessTokenUrl, useBasicAuth, clientId, clientSecret, redirectUri = '', scope = '', state = '') {
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
    useBasicAuth,
    clientId,
    clientSecret,
    authorizeResults[c.Q_CODE],
    redirectUri,
    state
  );

  return tokenResults;
}

async function _authorize (url, clientId, redirectUri = '', scope = '', state = '') {
  const params = [
    {name: c.Q_RESPONSE_TYPE, value: c.RESPONSE_TYPE_CODE},
    {name: c.Q_CLIENT_ID, value: clientId}
  ];

  // Add optional params
  redirectUri && params.push({name: c.Q_REDIRECT_URI, value: redirectUri});
  scope && params.push({name: c.Q_SCOPE, value: scope});
  state && params.push({name: c.Q_STATE, value: state});

  // Add query params to URL
  const qs = querystring.buildFromParams(params);
  const finalUrl = querystring.joinUrl(url, qs);

  const redirectedTo = await authorizeUserInWindow(finalUrl);
  const {query} = urlParse(redirectedTo, true);

  return {
    code: query[c.Q_CODE], // Required
    state: query[c.Q_STATE] || null // Optional
  };
}

async function _getToken (url, useBasicAuth, clientId, clientSecret, code, redirectUri = '', state = '') {
  const params = [
    {name: c.Q_GRANT_TYPE, value: c.GRANT_TYPE_AUTHORIZATION_CODE},
    {name: c.Q_CODE, value: code}
  ];

  // Add optional params
  redirectUri && params.push({name: c.Q_REDIRECT_URI, value: redirectUri});
  state && params.push({name: c.Q_STATE, value: state});

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/x-www-form-urlencoded, application/json'
  };

  if (useBasicAuth) {
    const {name, value} = getBasicAuthHeader(clientId, clientSecret);
    headers[name] = value;
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
