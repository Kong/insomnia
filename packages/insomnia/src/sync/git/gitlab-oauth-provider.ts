import { createHash, randomBytes } from 'crypto';
import { v4 as uuid } from 'uuid';

import { axiosRequest } from '../../network/axios-request';

// @TODO Replace with client id once we setup the app in GitLab
// @TODO possible discussion about fetching through ConfigService?
const GITLAB_OAUTH_CLIENT_ID = 'bc2c7db2345a8ccac9efa5180b0263418f4333e7fb5cb018824c19a283d006b2';
// const REDIRECT_URI = `${getAppWebsiteBaseURL()}/oauth/gitlab/callback`;
// @TODO replace this with the actual url - this is for demo purpose
const REDIRECT_URI = 'http://localhost:8002/oauth/gitlab/callback';
const GITLAB_TOKEN_STORAGE_KEY = 'gitlab-oauth-token';
const GITLAB_REFRESH_TOKEN_STORAGE_KEY = 'gitlab-oauth-refresh-token';

function base64URLEncode(buffer: Buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

const verifier = base64URLEncode(randomBytes(32));

/**
 * This cache stores the states that are generated for the OAuth flow.
 * This is used to check if a command to exchange a code for a token has been initiated by the app or not.
 */
const statesCache = new Set<string>();

export function generateAuthorizationUrl() {
  const state = uuid();
  statesCache.add(state);

  const scopes = ['api', 'read_user', 'write_repository', 'read_repository', 'email'];
  const scope = scopes.join(' ');

  function sha256(str: string) {
    return createHash('sha256').update(str).digest();
  }

  const challenge = base64URLEncode(sha256(verifier));

  const gitlabURL = new URL('https://gitlab.com/oauth/authorize');
  gitlabURL.search = new URLSearchParams({
    client_id: GITLAB_OAUTH_CLIENT_ID || '',
    scope,
    state,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();

  return gitlabURL.toString();
}

export async function exchangeCodeForGitLabToken(input: {
  code: string;
  state: string;
  scope: string;
}) {
  const { code, state } = input;
  if (!statesCache.has(state)) {
    throw new Error(
      'Invalid state parameter. It looks like the authorization flow was not initiated by the app.'
    );
  }

  const url = new URL('https://gitlab.com/oauth/token');

  url.search = new URLSearchParams({
    code,
    state,
    client_id: GITLAB_OAUTH_CLIENT_ID || '',
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  }).toString();

  return axiosRequest({
    url: url.toString(),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(result => {
    statesCache.delete(state);

    setAccessToken(result.data.access_token, result.data.refresh_token);
  });
}

export async function refreshToken() {
  const refreshToken = localStorage.getItem(GITLAB_REFRESH_TOKEN_STORAGE_KEY);

  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  const url = new URL('https://gitlab.com/oauth/token');

  url.search = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: GITLAB_OAUTH_CLIENT_ID || '',
  }).toString();

  return axiosRequest({
    url: url.toString(),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(result => {

    setAccessToken(result.data.access_token, result.data.refresh_token);

    return result.data.access_token;
  });
}

export function getAccessToken() {
  return localStorage.getItem(GITLAB_TOKEN_STORAGE_KEY);
}

export function getRefreshAccessToken() {
  return localStorage.getItem(GITLAB_REFRESH_TOKEN_STORAGE_KEY);
}

export function setAccessToken(token: string, refreshToken: string) {
  localStorage.setItem(GITLAB_TOKEN_STORAGE_KEY, token);
  localStorage.setItem(GITLAB_REFRESH_TOKEN_STORAGE_KEY, refreshToken);
}

export function signOut() {
  localStorage.removeItem(GITLAB_TOKEN_STORAGE_KEY);
  localStorage.removeItem(GITLAB_REFRESH_TOKEN_STORAGE_KEY);
}
