import crypto from 'crypto';

import { escapeRegex } from '../../common/misc';
import { RequestAuthentication } from '../../models/request';
import { invariant } from '../../utils/invariant';
import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../utils/url/querystring';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import * as c from './constants';
import { getOAuthSession, insertAuthKeyIf } from './misc';
export const grantAuthCodeUrl = (codeVerifier: string, {
  pkceMethod,
  clientId,
  scope,
  state,
  audience,
  resource,
  authorizationUrl,
  accessTokenUrl,
  redirectUrl }: Partial<RequestAuthentication>) => {
  invariant(authorizationUrl, 'Invalid authorization URL');
  invariant(accessTokenUrl, 'Invalid access token URL');
  const codeChallenge = pkceMethod !== c.PKCE_CHALLENGE_S256 ? codeVerifier : encodePKCE(crypto.createHash('sha256').update(codeVerifier).digest());
  return joinUrlAndQueryString(authorizationUrl, buildQueryStringFromParams([
    {
      name: 'response_type',
      value: c.RESPONSE_TYPE_CODE,
    },
    {
      name: 'client_id',
      value: clientId,
    },
    ...insertAuthKeyIf(redirectUrl, 'redirect_uri'),
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
export const grantAuthCodeParams = async (
  authentication: Partial<RequestAuthentication>,
) => {
  const { redirectUrl, usePkce } = authentication;
  console.log('auth', authentication);
  const urlSuccessRegex = new RegExp(`${escapeRegex(redirectUrl)}.*(code=)`, 'i');
  const urlFailureRegex = new RegExp(`${escapeRegex(redirectUrl)}.*(error=)`, 'i');
  const sessionId = getOAuthSession();
  const codeVerifier = usePkce ? encodePKCE(crypto.randomBytes(32)) : '';
  const authCodeUrl = grantAuthCodeUrl(codeVerifier, authentication);
  const redirectedTo = await window.main.authorizeUserInWindow({
    url: authCodeUrl,
    urlSuccessRegex,
    urlFailureRegex,
    sessionId,
  });

  console.log('[oauth2] Detected redirect ' + redirectedTo);
  const redirectParams = Object.fromEntries(new URL(redirectedTo).searchParams);

  // Handle the error
  if (redirectParams.error) {
    const code = redirectParams.error;
    const msg = redirectParams.error_description;
    const uri = redirectParams.error_uri;
    throw new Error(`OAuth 2.0 Error ${code}\n\n${msg}\n\n${uri}`);
  }
  const {
    state,
    audience,
    resource,
    credentialsInBody,
    clientId,
    clientSecret } = authentication;

  return [
    {
      name: 'grant_type',
      value: c.GRANT_TYPE_AUTHORIZATION_CODE,
    },
    {
      name: 'code',
      value: redirectParams.code,
    },
    ...insertAuthKeyIf(redirectUrl, 'redirect_uri'),
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
  ];

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
