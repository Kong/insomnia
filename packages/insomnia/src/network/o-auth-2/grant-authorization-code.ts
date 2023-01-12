import crypto from 'crypto';
import { parse as urlParse } from 'url';

import { CONTENT_TYPE_FORM_URLENCODED } from '../../common/constants';
import { escapeRegex } from '../../common/misc';
import * as models from '../../models/index';
import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../utils/url/querystring';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import { sendWithSettings } from '../network';
import * as c from './constants';
import { getOAuthSession, responseToObject } from './misc';
export const grantAuthCode = async (
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
  pkceMethod = c.PKCE_CHALLENGE_S256,
  origin = '',
) => {
  if (!authorizeUrl) {
    throw new Error('Invalid authorization URL');
  }

  if (!accessTokenUrl) {
    throw new Error('Invalid access token URL');
  }

  const codeVerifier = usePkce ? encodePKCE(crypto.randomBytes(32)) : '';
  const codeChallenge = pkceMethod === c.PKCE_CHALLENGE_S256 ? encodePKCE(crypto.createHash('sha256').update(codeVerifier).digest()) : codeVerifier;
  const authorizeResults = await _authorize(
    authorizeUrl,
    clientId,
    redirectUri,
    scope,
    state,
    audience,
    resource,
    codeChallenge,
    pkceMethod,
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
    authorizeResults.code,
    redirectUri,
    state,
    audience,
    resource,
    codeVerifier,
    origin,
  );
};

async function _authorize(
  url: string,
  clientId: string,
  redirectUri = '',
  scope = '',
  state = '',
  audience = '',
  resource = '',
  codeChallenge = '',
  pkceMethod = '',
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
    ...(scope ? [{
      name: c.P_SCOPE,
      value: scope,
    }] : []),
    ...(state ? [{
      name: c.P_STATE,
      value: state,
    }] : []),
    ...(audience ? [{
      name: c.P_AUDIENCE,
      value: audience,
    }] : []),
    ...(resource ? [{
      name: c.P_RESOURCE,
      value: resource,
    }] : []),
    ...(codeChallenge ? [{
      name: c.P_CODE_CHALLENGE,
      value: codeChallenge,
    },
    {
      name: c.P_CODE_CHALLENGE_METHOD,
      value: pkceMethod,
    }] : []),
  ];

  // Add query params to URL
  const qs = buildQueryStringFromParams(params);
  const finalUrl = joinUrlAndQueryString(url, qs);
  const urlSuccessRegex = new RegExp(`${escapeRegex(redirectUri)}.*(code=)`, 'i');
  const urlFailureRegex = new RegExp(`${escapeRegex(redirectUri)}.*(error=)`, 'i');
  const sessionId = getOAuthSession();

  const redirectedTo = await window.main.authorizeUserInWindow({ url: finalUrl, urlSuccessRegex, urlFailureRegex, sessionId });
  console.log('[oauth2] Detected redirect ' + redirectedTo);
  const { query } = urlParse(redirectedTo);
  return responseToObject(query, [
    'code',
    'state',
    'error',
    'error_description',
    'error_uri',
  ]);
}
const _getToken = async (
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
  origin = '',
) => {
  const responsePatch = await sendWithSettings(requestId, {
    headers: [
      {
        name: 'Content-Type',
        value: 'application/x-www-form-urlencoded',
      },
      {
        name: 'Accept',
        value: 'application/x-www-form-urlencoded, application/json',
      },
      ...(origin ? [{ name: 'Origin', value: origin }] : []),
    ],
    url,
    method: 'POST',
    body: {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: [
        {
          name: c.P_GRANT_TYPE,
          value: c.GRANT_TYPE_AUTHORIZATION_CODE,
        },
        {
          name: c.P_CODE,
          value: code,
        },
        ...(redirectUri ? [{
          name: c.P_REDIRECT_URI,
          value: redirectUri,
        }] : []),
        ...(state ? [{
          name: c.P_STATE,
          value: state,
        }] : []),
        ...(audience ? [{
          name: c.P_AUDIENCE,
          value: audience,
        }] : []),
        ...(resource ? [{
          name: c.P_RESOURCE,
          value: resource,
        }] : []),
        ...(codeVerifier ? [{
          name: c.P_CODE_VERIFIER,
          value: codeVerifier,
        }] : []),
        ...(credentialsInBody ? [{
          name: c.P_CLIENT_ID,
          value: clientId,
        }, {
          name: c.P_CLIENT_SECRET,
          value: clientSecret,
        }] : [getBasicAuthHeader(clientId, clientSecret)]),
      ],
    },
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
    'access_token',
    'id_token',
    'refresh_token',
    'expires_in',
    'token_type',
    'scope',
    'audience',
    'resource',
    'error',
    'error_uri',
    'error_description',
  ]);
  results[c.X_RESPONSE_ID] = response._id;
  return results;
};

const encodePKCE = (buffer: Buffer) => {
  return buffer.toString('base64')
    // The characters + / = are reserved for PKCE as per the RFC,
    // so we replace them with unreserved characters
    // Docs: https://tools.ietf.org/html/rfc7636#section-4.2
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};
