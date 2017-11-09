// @flow
import {parse as urlParse} from 'url';
import * as querystring from '../../common/querystring';
import * as c from './constants';
import {authorizeUserInWindow, responseToObject} from './misc';
import {escapeRegex, getBasicAuthHeader} from '../../common/misc';
import * as models from '../../models/index';
import * as network from '../network';

export default async function (
  requestId: string,
  authorizeUrl: string,
  accessTokenUrl: string,
  credentialsInBody: boolean,
  clientId: string,
  clientSecret: string,
  redirectUri: string = '',
  scope: string = '',
  state: string = ''
): Promise<Object> {
  if (!authorizeUrl) {
    throw new Error('Invalid authorization URL');
  }

  if (!accessTokenUrl) {
    throw new Error('Invalid access token URL');
  }

  const authorizeResults = await _authorize(
    authorizeUrl,
    clientId,
    redirectUri,
    scope,
    state
  );

  // TODO: Handle error

  const tokenResults = await _getToken(
    requestId,
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
  const regex = new RegExp(`${escapeRegex(redirectUri)}.*(code=|error=)`, 'i');

  const redirectedTo = await authorizeUserInWindow(finalUrl, regex);

  console.log('[oauth2] Detected redirect ' + redirectedTo);

  const {query} = urlParse(redirectedTo);
  return responseToObject(query, [
    c.P_CODE,
    c.P_STATE,
    c.P_ERROR,
    c.P_ERROR_DESCRIPTION,
    c.P_ERROR_URI
  ]);
}

async function _getToken (
  requestId: string,
  url: string,
  credentialsInBody: boolean,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string = '',
  state: string = ''
): Promise<Object> {
  const params = [
    {name: c.P_GRANT_TYPE, value: c.GRANT_TYPE_AUTHORIZATION_CODE},
    {name: c.P_CODE, value: code}
  ];

  // Add optional params
  redirectUri && params.push({name: c.P_REDIRECT_URI, value: redirectUri});
  state && params.push({name: c.P_STATE, value: state});

  const headers = [
    {name: 'Content-Type', value: 'application/x-www-form-urlencoded'},
    {name: 'Accept', value: 'application/x-www-form-urlencoded, application/json'}
  ];

  if (credentialsInBody) {
    params.push({name: c.P_CLIENT_ID, value: clientId});
    params.push({name: c.P_CLIENT_SECRET, value: clientSecret});
  } else {
    headers.push(getBasicAuthHeader(clientId, clientSecret));
  }

  const {response, bodyBuffer} = await network.sendWithSettings(requestId, {
    headers,
    url,
    method: 'POST',
    body: models.request.newBodyFormUrlEncoded(params)
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`[oauth2] Failed to fetch token url=${url} status=${response.statusCode}`);
  }

  const results = responseToObject(bodyBuffer.toString('utf8'), [
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
