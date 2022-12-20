import crypto from 'crypto';
import { parse as urlParse } from 'url';

import { CONTENT_TYPE_FORM_URLENCODED } from '../../common/constants';
import { escapeRegex } from '../../common/misc';
import * as models from '../../models/index';
import { RequestAuthentication } from '../../models/request';
import { invariant } from '../../utils/invariant';
import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../utils/url/querystring';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import { sendWithSettings } from '../network';
import * as c from './constants';
import { getOAuthSession, insertAuthKeyIf, parseAndFilter } from './misc';
export const grantAuthCodeUrl = (codeVerifier: string, {
  pkceMethod,
  clientId,
  scope,
  state,
  audience,
  resource,
  authorizeUrl,
  accessTokenUrl }: Partial<RequestAuthentication>) => {
  invariant(authorizeUrl, 'Invalid authorization URL');
  invariant(accessTokenUrl, 'Invalid access token URL');
  const codeChallenge = pkceMethod !== c.PKCE_CHALLENGE_S256 ? codeVerifier : encodePKCE(crypto.createHash('sha256').update(codeVerifier).digest());
  return joinUrlAndQueryString(authorizeUrl, buildQueryStringFromParams([
    {
      name: 'response_type',
      value: c.RESPONSE_TYPE_CODE,
    },
    {
      name: 'client_id',
      value: clientId,
    },
    ...insertAuthKeyIf(scope, 'scope'),
    ...insertAuthKeyIf(state, 'state'),
    ...insertAuthKeyIf(audience, 'audience'),
    ...insertAuthKeyIf(resource, 'resource'),
    ...(codeChallenge ? [{
      name: 'code_challenge',
      value: codeChallenge,
    },
    {
      name: 'code_challenge_method',
      value: pkceMethod,
    }] : []),
  ]));
};
export const grantAuthCode = async (
  requestId: string,
  authentication: Partial<RequestAuthentication>,
) => {
  const { redirectUri, usePkce } = authentication;

  const urlSuccessRegex = new RegExp(`${escapeRegex(redirectUri)}.*(code=)`, 'i');
  const urlFailureRegex = new RegExp(`${escapeRegex(redirectUri)}.*(error=)`, 'i');
  const sessionId = getOAuthSession();
  const codeVerifier = usePkce ? encodePKCE(crypto.randomBytes(32)) : '';

  const redirectedTo = await window.main.authorizeUserInWindow({
    url: grantAuthCodeUrl(codeVerifier, authentication),
    urlSuccessRegex,
    urlFailureRegex,
    sessionId,
  });
  console.log('[oauth2] Detected redirect ' + redirectedTo);
  const { query } = urlParse(redirectedTo);
  const authorizeResults = parseAndFilter(query, [
    'code',
    'state',
    'error',
    'error_description',
    'error_uri',
  ]);

  // Handle the error
  if (authorizeResults.error) {
    const code = authorizeResults.error;
    const msg = authorizeResults.error_description;
    const uri = authorizeResults.error_uri;
    throw new Error(`OAuth 2.0 Error ${code}\n\n${msg}\n\n${uri}`);
  }
  const { accessTokenUrl,
    state,
    audience,
    resource,
    credentialsInBody,
    clientId,
    clientSecret } = authentication;

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
    url: accessTokenUrl,
    method: 'POST',
    body: {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: [
        {
          name: 'grant_type',
          value: c.GRANT_TYPE_AUTHORIZATION_CODE,
        },
        {
          name: 'code',
          value: authorizeResults.code,
        },
        ...insertAuthKeyIf(redirectUri, 'redirect_uri'),
        ...insertAuthKeyIf(state, 'state'),
        ...insertAuthKeyIf(audience, 'audience'),
        ...insertAuthKeyIf(resource, 'resource'),
        ...insertAuthKeyIf(codeVerifier, 'code_verifier'),
        ...(credentialsInBody ? [{
          name: 'client_id',
          value: clientId,
        }, {
          name: 'client_secret',
          value: clientSecret,
        }] : [getBasicAuthHeader(clientId, clientSecret)]),
      ],
    },
  });
  const response = await models.response.create(responsePatch);
  const bodyBuffer = models.response.getBodyBuffer(response);

  if (!bodyBuffer) {
    return {
      [c.X_ERROR]: `No body returned from ${accessTokenUrl}`,
      [c.X_RESPONSE_ID]: response._id,
    };
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    return {
      [c.X_ERROR]: `Failed to fetch token url=${accessTokenUrl} status=${response.statusCode}`,
      [c.X_RESPONSE_ID]: response._id,
    };
  }

  const results = parseAndFilter(bodyBuffer.toString('utf8'), [
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
