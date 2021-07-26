import crypto from 'crypto';
import { buildQueryStringFromParams, joinUrlAndQueryString } from 'insomnia-url';
import { parse as urlParse } from 'url';

import { escapeRegex } from '../../common/misc';
import * as models from '../../models/index';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import { sendWithSettings } from '../network';
import * as c from './constants';
import { authorizeUserInWindow, responseToObject } from './misc';

export default async function(
  requestId: string,
  authorizeUrl: string,
  accessTokenUrl: string,
  credentialsInBody: boolean,
  clientId: string,
  clientSecret: string,
  redirectUri = '',
  scope = '',
  state = '',
  audience = '',
  resource = '',
  usePkce = false,
): Promise<Record<string, any>> {
  if (!authorizeUrl) {
    throw new Error('Invalid authorization URL');
  }

  if (!accessTokenUrl) {
    throw new Error('Invalid access token URL');
  }

  let codeVerifier = '';
  let codeChallenge = '';

  if (usePkce) {
    // @ts-expect-error -- TSCONVERSION
    codeVerifier = _base64UrlEncode(crypto.randomBytes(32));
    // @ts-expect-error -- TSCONVERSION
    codeChallenge = _base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());
  }

  const authorizeResults = await _authorize(
    authorizeUrl,
    clientId,
    redirectUri,
    scope,
    state,
    audience,
    resource,
    codeChallenge,
  );

  // Handle the error
  if (authorizeResults[c.P_ERROR]) {
    const code = authorizeResults[c.P_ERROR];
    const msg = authorizeResults[c.P_ERROR_DESCRIPTION];
    const uri = authorizeResults[c.P_ERROR_URI];
    throw new Error(`OAuth 2.0 Error ${code}\n\n${msg}\n\n${uri}`);
  }

  return _getToken(
    requestId,
    accessTokenUrl,
    credentialsInBody,
    clientId,
    clientSecret,
    authorizeResults[c.P_CODE],
    redirectUri,
    state,
    audience,
    resource,
    codeVerifier,
  );
}

async function _authorize(
  url,
  clientId,
  redirectUri = '',
  scope = '',
  state = '',
  audience = '',
  resource = '',
  codeChallenge = '',
) {
  const params = [
    {
      name: c.P_RESPONSE_TYPE,
      value: c.RESPONSE_TYPE_CODE,
    },
    {
      name: c.P_CLIENT_ID,
      value: clientId,
    },
  ];
  // Add optional params
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
  resource &&
    params.push({
      name: c.P_RESOURCE,
      value: resource,
    });

  if (codeChallenge) {
    params.push({
      name: c.P_CODE_CHALLENGE,
      value: codeChallenge,
    });
    params.push({
      name: c.P_CODE_CHALLENGE_METHOD,
      value: 'S256',
    });
  }

  // Add query params to URL
  const qs = buildQueryStringFromParams(params);
  const finalUrl = joinUrlAndQueryString(url, qs);
  const successRegex = new RegExp(`${escapeRegex(redirectUri)}.*(code=)`, 'i');
  const failureRegex = new RegExp(`${escapeRegex(redirectUri)}.*(error=)`, 'i');
  const redirectedTo = await authorizeUserInWindow(finalUrl, successRegex, failureRegex);
  console.log('[oauth2] Detected redirect ' + redirectedTo);
  const { query } = urlParse(redirectedTo);
  return responseToObject(query, [
    c.P_CODE,
    c.P_STATE,
    c.P_ERROR,
    c.P_ERROR_DESCRIPTION,
    c.P_ERROR_URI,
  ]);
}

async function _getToken(
  requestId: string,
  url: string,
  credentialsInBody: boolean,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri = '',
  state = '',
  audience = '',
  resource = '',
  codeVerifier = '',
): Promise<Record<string, any>> {
  const params = [
    {
      name: c.P_GRANT_TYPE,
      value: c.GRANT_TYPE_AUTHORIZATION_CODE,
    },
    {
      name: c.P_CODE,
      value: code,
    },
  ];
  // Add optional params
  redirectUri &&
    params.push({
      name: c.P_REDIRECT_URI,
      value: redirectUri,
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
  resource &&
    params.push({
      name: c.P_RESOURCE,
      value: resource,
    });
  codeVerifier &&
    params.push({
      name: c.P_CODE_VERIFIER,
      value: codeVerifier,
    });
  const headers = [
    {
      name: 'Content-Type',
      value: 'application/x-www-form-urlencoded',
    },
    {
      name: 'Accept',
      value: 'application/x-www-form-urlencoded, application/json',
    },
  ];

  if (credentialsInBody) {
    params.push({
      name: c.P_CLIENT_ID,
      value: clientId,
    });
    params.push({
      name: c.P_CLIENT_SECRET,
      value: clientSecret,
    });
  } else {
    headers.push(getBasicAuthHeader(clientId, clientSecret));
  }

  const responsePatch = await sendWithSettings(requestId, {
    headers,
    url,
    method: 'POST',
    body: models.request.newBodyFormUrlEncoded(params),
  });
  const response = await models.response.create(responsePatch);
  // @ts-expect-error -- TSCONVERSION
  const bodyBuffer = models.response.getBodyBuffer(response);

  if (!bodyBuffer) {
    return {
      [c.X_ERROR]: `No body returned from ${url}`,
      [c.X_RESPONSE_ID]: response._id,
    };
  }

  // @ts-expect-error -- TSCONVERSION
  const statusCode = response.statusCode || 0;

  if (statusCode < 200 || statusCode >= 300) {
    return {
      [c.X_ERROR]: `Failed to fetch token url=${url} status=${statusCode}`,
      [c.X_RESPONSE_ID]: response._id,
    };
  }

  const results = responseToObject(bodyBuffer.toString('utf8'), [
    c.P_ACCESS_TOKEN,
    c.P_ID_TOKEN,
    c.P_REFRESH_TOKEN,
    c.P_EXPIRES_IN,
    c.P_TOKEN_TYPE,
    c.P_SCOPE,
    c.P_AUDIENCE,
    c.P_RESOURCE,
    c.P_ERROR,
    c.P_ERROR_URI,
    c.P_ERROR_DESCRIPTION,
  ]);
  results[c.X_RESPONSE_ID] = response._id;
  return results;
}

function _base64UrlEncode(str: string) {
  // @ts-expect-error -- TSCONVERSION appears to be genuine
  return str.toString('base64')
    // The characters + / = are reserved for PKCE as per the RFC,
    // so we replace them with unreserved characters
    // Docs: https://tools.ietf.org/html/rfc7636#section-4.2
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
