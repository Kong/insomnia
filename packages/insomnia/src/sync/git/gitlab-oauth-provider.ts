import { createHash, randomBytes } from 'crypto';
import { v4 as uuid } from 'uuid';

import { getApiBaseURL } from '../../common/constants';

const env = process['env'];

// Warning: As this is a global fetch we need to handle errors, retries and caching
// GitLab API config
const getGitLabConfig = async () => {
  const { INSOMNIA_GITLAB_REDIRECT_URI, INSOMNIA_GITLAB_CLIENT_ID } = env;

  // Validate and use the environment variables if provided
  if (
    (INSOMNIA_GITLAB_REDIRECT_URI && !INSOMNIA_GITLAB_CLIENT_ID) ||
    (!INSOMNIA_GITLAB_REDIRECT_URI && INSOMNIA_GITLAB_CLIENT_ID)
  ) {
    throw new Error('GitLab Client ID and Redirect URI must both be set.');
  }

  if (INSOMNIA_GITLAB_REDIRECT_URI && INSOMNIA_GITLAB_CLIENT_ID) {
    return {
      clientId: INSOMNIA_GITLAB_CLIENT_ID,
      redirectUri: INSOMNIA_GITLAB_REDIRECT_URI,
    };
  }

  const apiURL = getApiBaseURL();
  // Otherwise fetch the config for the GitLab API
  return window.main.axiosRequest({
    url: apiURL + '/v1/oauth/gitlab/config',
    method: 'GET',
  }).then(({ data }) => {
    return {
      clientId: data.applicationId,
      redirectUri: data.redirectUri,
    };
  });
};

export const getGitLabOauthApiURL = () =>
  env.INSOMNIA_GITLAB_API_URL || 'https://gitlab.com';
const GITLAB_TOKEN_STORAGE_KEY = 'gitlab-oauth-token';
const GITLAB_REFRESH_TOKEN_STORAGE_KEY = 'gitlab-oauth-refresh-token';

function base64URLEncode(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * This cache stores the states that are generated for the OAuth flow.
 * This is used to check if a command to exchange a code for a token has been initiated by the app or not.
 */
const statesCache = new Map<string, string>();

export async function generateAuthorizationUrl() {
  const state = uuid();

  const verifier = base64URLEncode(randomBytes(32));
  statesCache.set(state, verifier);

  const scopes = [
    // Needed to read the user's email address, username and avatar_url from the /user GitLab API
    'read_user',
    // Read/Write access to the user's projects to allow for syncing (push/pull etc.)
    'write_repository',
  ];

  const scope = scopes.join(' ');

  function sha256(str: string) {
    return createHash('sha256').update(str).digest();
  }

  const challenge = base64URLEncode(sha256(verifier));

  const gitlabURL = new URL(`${getGitLabOauthApiURL()}/oauth/authorize`);
  const { clientId, redirectUri } = await getGitLabConfig();
  gitlabURL.search = new URLSearchParams({
    client_id: clientId,
    scope,
    state,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();

  return gitlabURL.toString();
}

export async function exchangeCodeForGitLabToken(input: {
  code: string;
  state: string;
}) {
  const { code, state } = input;

  const verifier = statesCache.get(state);
  if (!verifier) {
    throw new Error(
      'Invalid state parameter. It looks like the authorization flow was not initiated by the app.'
    );
  }
  const { clientId, redirectUri } = await getGitLabConfig();
  const url = new URL(`${getGitLabOauthApiURL()}/oauth/token`);
  url.search = new URLSearchParams({
    code,
    state,
    client_id: clientId,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: verifier,
  }).toString();

  return window.main.axiosRequest({
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
  const { clientId } = await getGitLabConfig();
  const url = new URL(`${getGitLabOauthApiURL()}/oauth/token`);

  url.search = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  }).toString();

  return window.main.axiosRequest({
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
