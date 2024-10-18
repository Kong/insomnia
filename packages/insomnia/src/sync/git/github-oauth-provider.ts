import { v4 } from 'uuid';

import { getAppWebsiteBaseURL, getGitHubGraphQLApiURL } from '../../common/constants';
import { insomniaFetch } from '../../ui/insomniaFetch';

export const GITHUB_TOKEN_STORAGE_KEY = 'github-oauth-token';
export const GITHUB_GRAPHQL_API_URL = getGitHubGraphQLApiURL();

/**
 * This cache stores the states that are generated for the OAuth flow.
 * This is used to check if a command to exchange a code for a token has been initiated by the app or not.
 * More info https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github
 */
const statesCache = new Set<string>();

export function generateAppAuthorizationUrl() {
  const state = v4();
  statesCache.add(state);
  const url = new URL(getAppWebsiteBaseURL() + '/oauth/github-app');

  url.search = new URLSearchParams({
    state,
  }).toString();

  return url.toString();
}

export async function exchangeCodeForToken({
  code,
  state,
  path,
}: {
  code: string;
  state: string;
  path: string;
}) {
  if (!statesCache.has(state)) {
    throw new Error(
      'Invalid state parameter. It looks like the authorization flow was not initiated by the app.'
    );
  }

  return insomniaFetch<{ access_token: string }>({
    path,
    method: 'POST',
    data: {
      code,
    },
    sessionId: '',
  }).then(data => {
    statesCache.delete(state);
    setAccessToken(data.access_token);
  });
}

export function getAccessToken() {
  return localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY);
}

export function setAccessToken(token: string) {
  return localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, token);
}

export function signOut() {
  localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
}
