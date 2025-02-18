import { createHash, randomBytes } from 'crypto';
import { shell } from 'electron';
import { net } from 'electron/main';
import { v4 } from 'uuid';

import { getApiBaseURL, getAppWebsiteBaseURL, getGitHubGraphQLApiURL, getGitHubRestApiUrl, INSOMNIA_GITLAB_API_URL, INSOMNIA_GITLAB_CLIENT_ID, INSOMNIA_GITLAB_REDIRECT_URI, PLAYWRIGHT } from '../common/constants';
import * as models from '../models';
import { ipcMainHandle } from './ipc/electron';

export const GITHUB_GRAPHQL_API_URL = getGitHubGraphQLApiURL();

/**
 * This cache stores the states that are generated for the OAuth flow.
 * This is used to check if a command to exchange a code for a token has been initiated by the app or not.
 * More info https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github
 */
const statesCache = new Set<string>();

async function initSignInToGitHub() {
  const state = v4();
  statesCache.add(state);
  const url = new URL(getAppWebsiteBaseURL() + '/oauth/github-app');

  url.search = new URLSearchParams({
    state,
  }).toString();

  // eslint-disable-next-line no-restricted-properties
  await shell.openExternal(url.toString());
}

interface GitHubUserApiResponse {
  name: string;
  login: string;
  email: string | null;
  avatar_url: string;
  url: string;
}

async function completeSignInToGitHub({
  code,
  state,
}: {
  code: string;
  state: string;
}) {
  if (!PLAYWRIGHT && !statesCache.has(state)) {
    throw new Error(
      'Invalid state parameter. It looks like the authorization flow was not initiated by the app.'
    );
  }

  const response = await net.fetch(getApiBaseURL() + '/v1/oauth/github-app', {
    method: 'POST',
    body: JSON.stringify({
      code,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as { access_token: string };
  statesCache.delete(state);
  const existingGitHubCredentials = await models.gitCredentials.getByProvider('github');

  // need both requests because the email in GET /user
  // is the public profile email and may not exist
  const emailsPromise = fetch(getGitHubRestApiUrl() + '/user/emails', {
    method: 'GET',
    headers: {
      Authorization: `token ${data.access_token}`,
    },
  }).then(response => response.json() as Promise<{ email: string; primary: boolean }[]>);

  const userPromise = fetch(getGitHubRestApiUrl() + '/user', {
    method: 'GET',
    headers: {
      Authorization: `token ${data.access_token}`,
    },
  }).then(response => response.json() as Promise<GitHubUserApiResponse>);

  const [emails, user] = await Promise.all([
    emailsPromise,
    userPromise,
  ]);

  const userProfileEmail = user.email ?? '';
  const email = emails.find(e => e.primary)?.email ?? userProfileEmail;

  if (existingGitHubCredentials) {
    await models.gitCredentials.update(existingGitHubCredentials, {
      token: data.access_token,
      provider: 'githubapp',
      author: {
        email,
        name: user.name,
        avatarUrl: user.avatar_url,
      },
    });
  } else {
    await models.gitCredentials.create({
      token: data.access_token,
      provider: 'githubapp',
      author: {
        email,
        name: user.name,
        avatarUrl: user.avatar_url,
      },
    });
  }
}

async function signOutOfGitHub() {
  const existingGitHubCredentials = await models.gitCredentials.getByProvider('github');

  if (existingGitHubCredentials) {
    await models.gitCredentials.remove(existingGitHubCredentials);
  }
}

/**
 * This cache stores the states that are generated for the OAuth flow.
 * This is used to check if a command to exchange a code for a token has been initiated by the app or not.
 */
const gitLabStatesCache = new Map<string, string>();

// GitLab API config
const getGitLabConfig = async () => {
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

  const configResponse = await fetch(getApiBaseURL() + '/v1/oauth/gitlab/config', {
    method: 'GET',
  });

  const { applicationId: clientId, redirectUri } = await configResponse.json() as { applicationId: string; redirectUri: string };

  return {
    clientId,
    redirectUri,
  };
};

function base64URLEncode(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export const getGitLabOauthApiURL = () => INSOMNIA_GITLAB_API_URL || 'https://gitlab.com';

async function initSignInToGitLab() {
  const state = v4();

  const verifier = base64URLEncode(randomBytes(32));
  gitLabStatesCache.set(state, verifier);

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

  // eslint-disable-next-line no-restricted-properties
  await shell.openExternal(gitlabURL.toString());
}

async function completeSignInToGitLab({
  code,
  state,
}: {
  code: string;
  state: string;
}) {
  let verifier = gitLabStatesCache.get(state);

  if (PLAYWRIGHT) {
    verifier = 'test-verifier';
  }

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

  const gitLabResponse = await fetch(getGitLabOauthApiURL() + url.pathname + url.search, {
    method: 'POST',
  });

  const {
    access_token,
    refresh_token,
  } = await gitLabResponse.json() as { access_token: string; refresh_token: string };

  gitLabStatesCache.delete(state);
  const existingGitLabCredentials = await models.gitCredentials.getByProvider('gitlab');

  const gitLabUserResponse = await fetch(`${getGitLabOauthApiURL()}/api/v4/user`, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  const user = await gitLabUserResponse.json() as {
    id: number;
    username: string;
    name: string;
    avatar_url: string;
    public_email: string;
    email: string;
    projects_limit: number;
    commit_email: string;
  };

  if (existingGitLabCredentials) {
    return await models.gitCredentials.update(existingGitLabCredentials, {
      token: access_token,
      refreshToken: refresh_token,
      provider: 'gitlab',
      author: {
        email: user.commit_email ?? user.public_email ?? user.email,
        name: user.username ?? user.name,
        avatarUrl: user.avatar_url,
      },
    });
  }

  return await models.gitCredentials.create({
    token: access_token,
    refreshToken: refresh_token,
    provider: 'gitlab',
    author: {
      email: user.commit_email ?? user.public_email ?? user.email,
      name: user.username ?? user.name,
      avatarUrl: user.avatar_url,
    },
  });
}

async function signOutOfGitLab() {
  const existingGitLabCredentials = await models.gitCredentials.getByProvider('gitlab');

  if (existingGitLabCredentials) {
    await models.gitCredentials.remove(existingGitLabCredentials);
  }
}

export interface GitServiceAPI {
  initSignInToGitHub: typeof initSignInToGitHub;
  completeSignInToGitHub: typeof completeSignInToGitHub;
  signOutOfGitHub: typeof signOutOfGitHub;
  initSignInToGitLab: typeof initSignInToGitLab;
  completeSignInToGitLab: typeof completeSignInToGitLab;
  signOutOfGitLab: typeof signOutOfGitLab;
}

export const registerGitServiceAPI = () => {
  ipcMainHandle('git.completeSignInToGitHub', (_, options: Parameters<typeof completeSignInToGitHub>[0]) => completeSignInToGitHub(options));
  ipcMainHandle('git.initSignInToGitHub', () => initSignInToGitHub());
  ipcMainHandle('git.signOutOfGitHub', () => signOutOfGitHub());
  ipcMainHandle('git.completeSignInToGitLab', (_, options: Parameters<typeof completeSignInToGitLab>[0]) => completeSignInToGitLab(options));
  ipcMainHandle('git.initSignInToGitLab', () => initSignInToGitLab());
  ipcMainHandle('git.signOutOfGitLab', () => signOutOfGitLab());
};
