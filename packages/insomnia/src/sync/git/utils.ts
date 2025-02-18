import type { AuthCallback, AuthFailureCallback, AuthSuccessCallback, GitAuth, MessageCallback } from 'isomorphic-git';

import { gitCredentials } from '../../models';
import type { OauthProviderName } from '../../models/git-repository';
import type { GitCredentials } from './git-vcs';

export const addDotGit = (url: string): string => (url.endsWith('.git') ? url : `${url}.git`);

const onMessage: MessageCallback = message => {
  console.log(`[git-event] ${message}`);
};

const onAuthFailure =
  (credentials?: GitCredentials): AuthFailureCallback =>
    async (message, auth) => {
      console.log(`[git-event] Auth Failure: ${message}`);

      // Try to refresh the token if auth failed.
      // Whenever we return a new GitAuth object from this function
      // isomorphic-git will retry the request with the new credentials.
      // https://isomorphic-git.org/docs/en/onAuthFailure#docsNav
      if (
        credentials &&
      'oauth2format' in credentials &&
      credentials.oauth2format === 'gitlab'
      ) {
        console.log('[git-event] Attempting to refresh token');
        try {
          const providerCredentials = await gitCredentials.getByProvider(credentials.oauth2format);
          if (providerCredentials?.refreshToken) {
            console.log('[git-event] Token refreshed');
            return {
              ...auth,
              password: providerCredentials.refreshToken,
              headers: {
                ...auth.headers,
                Authorization: `Bearer ${providerCredentials.refreshToken}`,
              },
            };
          }
        } catch (error) {
          console.warn('[git-event] Failed to refresh token', error);
          return;
        }
      }

      return;
    };

const onAuthSuccess: AuthSuccessCallback = message => {
  console.log(`[git-event] Auth Success: ${message}`);
};

const onAuth = (credentials?: GitCredentials): AuthCallback => async (): Promise<GitAuth> => {
  if (!credentials) {
    console.log('[git-event] No credentials');
    return {
      username: '',
      password: '',
    };
  }

  if ('oauth2format' in credentials && credentials.oauth2format) {
    console.log('[git-event] Using OAuth2 credentials');
    const providerCredentials = await gitCredentials.getByProvider(credentials.oauth2format);

    if (!providerCredentials) {
      console.warn('[git-event] No OAuth2 credentials found');
      return {
        username: '',
        password: '',
      };
    }

    // Transform the credentials to the format expected by isomorphic-git https://isomorphic-git.org/docs/en/onAuth#oauth2-tokens
    if (providerCredentials.provider === 'gitlab') {
      return {
        username: 'oauth2',
        password: providerCredentials.token,
      };
    }

    if (providerCredentials.provider === 'github') {
      return {
        username: providerCredentials.token,
        password: 'x-oauth-basic',
      };
    }

    if (providerCredentials.provider === 'githubapp') {
      return {
        username: 'x-access-token',
        password: providerCredentials.token,
      };
    }
  }

  console.log('[git-event] Using basic auth credentials');
  return {
    username: credentials.username,
    // @ts-expect-error -- TSCONVERSION this needs to be handled better if credentials is undefined or which union type
    password: credentials.password || credentials.token,
  };
};

export const getOauth2FormatName = (credentials?: GitCredentials | null): OauthProviderName | undefined => {
  if (credentials && 'oauth2format' in credentials) {
    return credentials.oauth2format;
  }

  return;
};

export const gitCallbacks = (credentials?: GitCredentials | null) => ({
  onMessage,
  onAuthFailure: onAuthFailure(credentials ?? undefined),
  onAuthSuccess,
  onAuth: onAuth(credentials ?? undefined),
});
