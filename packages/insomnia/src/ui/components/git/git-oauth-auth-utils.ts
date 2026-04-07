import type { GitCredentials, GitRepository } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import { getOauth2FormatName } from '~/sync/git/get-oauth2-format-name';

const { isGitCredentialsV2, isOAuthCredential } = models.gitCredentials;

/** GitHub App user tokens start with `ghu_` (see {@link isGitHubAppUserToken} in github-app-config-link). */
function isGitHubAppUserToken(token?: string): boolean {
  return `${token}`.startsWith('ghu_');
}

/**
 * True when the stored OAuth access token has an absolute expiry and it is in the past.
 */
export function isOAuthAccessTokenExpired(credential: GitCredentials | null | undefined): boolean {
  if (!credential || !isGitCredentialsV2(credential) || !isOAuthCredential(credential)) {
    return false;
  }
  const expiresAt = credential.credentials.expiresAt;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    return false;
  }
  return Date.now() > expiresAt;
}

/**
 * Git load/sync errors often look like `HTTP Error: 401 ...` (isomorphic-git).
 */
export function isGitRepoLoadAuthHttp40Error(errors: string[] | undefined): boolean {
  return Boolean(errors?.length && errors[0].startsWith('HTTP Error: 40'));
}

/**
 * Same conditions as {@link ConfigLink}: legacy repo-embedded GitHub App user token + HTTP 4xx from git.
 */
export function shouldShowConfigureGitHubAppLink(
  gitRepository: GitRepository | null | undefined,
  errors: string[] | undefined,
): boolean {
  return Boolean(
    gitRepository?.credentials &&
      'oauth2format' in gitRepository.credentials &&
      getOauth2FormatName(gitRepository.credentials) === 'github' &&
      isGitHubAppUserToken(gitRepository.credentials.token) &&
      isGitRepoLoadAuthHttp40Error(errors),
  );
}

/**
 * Fallback when `expiresAt` is unknown: show reauth hint if git reported HTTP 4xx and auth looks OAuth-related.
 */
export function shouldShowHttp40OAuthReauthHint(args: {
  errors?: string[];
  gitRepository?: GitRepository | null;
  selectedCredential?: GitCredentials | null;
}): boolean {
  const { errors, gitRepository, selectedCredential } = args;
  if (!isGitRepoLoadAuthHttp40Error(errors)) {
    return false;
  }
  if (shouldShowConfigureGitHubAppLink(gitRepository, errors)) {
    return true;
  }
  if (selectedCredential && isGitCredentialsV2(selectedCredential) && isOAuthCredential(selectedCredential)) {
    return true;
  }
  return false;
}
