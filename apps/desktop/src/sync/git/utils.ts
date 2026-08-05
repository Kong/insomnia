import { spawn } from 'node:child_process';

import type { GitAuthor } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import type { AuthCallback, AuthFailureCallback, AuthSuccessCallback, GitAuth, MessageCallback } from 'isomorphic-git';

import { invariant } from '~/common/utils/invariant';
import { gitRemoteProviderRegistry } from '~/sync/git/providers';

// Re-exported for backwards compatibility. The pure URL helpers live in a
// provider/electron-free module so they can be imported from the renderer.
export { addDotGit, ensureGitRepoUrlSuffix, isAzureDevOpsUrl } from './url-utils';

const { isGitCredentialsV2, isGitCredentialsV1 } = models.gitCredentials;

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
  (credentialsId?: string | null, repoPath?: string): AuthCallback =>
  async (url): Promise<GitAuth> => {
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
      const gitAuth = provider.authCallback(credentials, url, repoPath);
      return gitAuth;
    }

    return {
      username: '',
      password: '',
    };
  };

const getGitConfigValue = (key: string, cwd: string): Promise<string> =>
  new Promise(resolve => {
    const chunks: string[] = [];
    const proc = spawn('git', ['config', key], { cwd });
    proc.stdout.on('data', (d: Buffer) => chunks.push(d.toString()));
    proc.on('close', () => resolve(chunks.join('').trim()));
    proc.on('error', () => resolve(''));
  });

export const getAuthorFromGitRepository = async (gitRepositoryId: string, repoPath?: string): Promise<GitAuthor> => {
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

  if (credentials.provider === 'native') {
    if (!repoPath) {
      return { name: '', email: '' };
    }
    const [name, email] = await Promise.all([
      getGitConfigValue('user.name', repoPath),
      getGitConfigValue('user.email', repoPath),
    ]);
    return { name, email };
  }

  return {
    name: credentials.author.name,
    email: gitRepo.selectedAuthorEmail || credentials.author.email,
  };
};

export const gitCallbacks = (credentialsId?: string | null, repoPath?: string) => {
  return {
    onMessage,
    onAuthFailure: onAuthFailure(credentialsId),
    onAuthSuccess,
    onAuth: onAuth(credentialsId, repoPath),
  };
};
