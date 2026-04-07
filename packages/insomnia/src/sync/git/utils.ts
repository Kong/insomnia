import type { AuthCallback, AuthFailureCallback, AuthSuccessCallback, GitAuth, MessageCallback } from 'isomorphic-git';

import { type GitAuthor, models, services } from '~/insomnia-data';
import { gitRemoteProviderRegistry } from '~/sync/git/providers';
import { invariant } from '~/utils/invariant';

const { isGitCredentialsV2, isGitCredentialsV1 } = models.gitCredentials;

export const addDotGit = (url: string): string => (url.endsWith('.git') ? url : `${url}.git`);

/**
 * OAuth2 token responses often include `expires_in` (seconds until access token expires).
 * We store an absolute ms timestamp on git credentials as `credentials.expiresAt`.
 */
export function expiresAtFromOAuthExpiresIn(expiresInSeconds?: number): number | undefined {
  if (typeof expiresInSeconds !== 'number' || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    return undefined;
  }
  return Date.now() + Math.floor(expiresInSeconds) * 1000;
}

const onMessage: MessageCallback = message => {
  console.log(`[git-event] ${message}`);
};

const onAuthFailure = (credentialsId?: string | null): AuthFailureCallback => {
  return async url => {
    console.log(`[git-event] Auth Failure: ${url}`);

    try {
      invariant(credentialsId, 'No credentials ID provided for auth failure handling');
      const credentials = await services.gitCredentials.getById(credentialsId);
      invariant(credentials, 'Credentials not found for auth failure handling');
      invariant(isGitCredentialsV2(credentials), 'Legacy credentials are not supported');

      const provider = gitRemoteProviderRegistry.get(credentials.provider);

      if (!provider || !provider.authFailureCallback) {
        console.log('[git-event] No provider or auth failure callback available');
        return;
      }

      const authFailureCallback = provider.authFailureCallback(credentials);

      return authFailureCallback;
    } catch (error) {
      console.warn('[git-event] Failed to refresh token', error);
      return;
    }
  };
};

const onAuthSuccess: AuthSuccessCallback = message => {
  console.log(`[git-event] Auth Success: ${message}`);
};

const onAuth =
  (credentialsId?: string | null): AuthCallback =>
  async (): Promise<GitAuth> => {
    if (!credentialsId) {
      console.log('[git-event] No credentials');
      return {
        username: '',
        password: '',
      };
    }

    const credentials = await services.gitCredentials.getById(credentialsId);

    if (!credentials || isGitCredentialsV1(credentials)) {
      console.log('[git-event] No credentials found or using legacy credentials');
      return {
        username: '',
        password: '',
      };
    }

    const provider = gitRemoteProviderRegistry.get(credentials.provider);

    if (provider && provider.authCallback) {
      console.log(`[git-event] Using provider ${provider.config.type} for auth callback`);
      const gitAuth = provider.authCallback(credentials);
      return gitAuth;
    }

    return {
      username: '',
      password: '',
    };
  };

export const getAuthorFromGitRepository = async (gitRepositoryId: string): Promise<GitAuthor> => {
  const gitRepo = await services.gitRepository.getById(gitRepositoryId);

  if (!gitRepo || !gitRepo.credentialsId) {
    return {
      name: '',
      email: '',
    };
  }

  const credentials = await services.gitCredentials.getById(gitRepo.credentialsId);

  if (!credentials || isGitCredentialsV1(credentials)) {
    return {
      name: '',
      email: '',
    };
  }

  return {
    name: credentials.author.name,
    email: gitRepo.selectedAuthorEmail || credentials.author.email,
  };
};

export const gitCallbacks = (credentialsId?: string | null) => {
  return {
    onMessage,
    onAuthFailure: onAuthFailure(credentialsId),
    onAuthSuccess,
    onAuth: onAuth(credentialsId),
  };
};
