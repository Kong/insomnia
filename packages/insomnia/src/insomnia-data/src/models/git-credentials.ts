import type { BaseModel } from '~/models/types';

export type OauthProviderName = 'gitlab' | 'github';

// New unified provider types
export type GitRemoteProviderType = 'github' | 'gitlab' | 'custom';

export type GitCredentials = BaseModel & BaseGitCredentials;

export type GitCredentialsV1 = BaseModel & BaseGitCredentialsV1;
export type GitCredentialsV2 = BaseModel & BaseGitCredentialsV2;
export type CustomGitCredentialV2 = BaseModel & CustomCredential;

export const name = 'Git Credentials';

export const type = 'GitCredentials';

export const prefix = 'git_creds';

export const canDuplicate = false;

export const canSync = false;

export function init(): Partial<BaseGitCredentials> {
  return {
    name: '',
    provider: undefined,
    credentials: undefined,
    author: {
      email: '',
      name: '',
      avatarUrl: '',
    },
    // Legacy fields: token and refreshToken for backward compatibility
    token: undefined,
    refreshToken: undefined,
  };
}

/**
 * Legacy git credentials interface (for backward compatibility)
 * @deprecated Use the new provider-specific credential types
 */
interface BaseGitCredentialsV1 {
  /** @deprecated Use provider-specific credentials.token instead */
  token: string;
  /** @deprecated Use provider-specific credentials.refreshToken instead */
  refreshToken?: string;
  provider: 'githubapp' | 'github' | 'gitlab' | 'custom';
  author: {
    avatarUrl?: string;
    name: string;
    email: string;
  };
}

/**
 * Email from provider
 */
export interface ProviderEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * Base credential data for all providers
 */
interface BaseCredentialData {
  name: string; // User-friendly name, e.g., "Work GitHub"
  provider: GitRemoteProviderType;
  author: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

/**
 * GitHub OAuth credential
 */
interface GitHubCredential extends BaseCredentialData {
  provider: 'github';
  credentials: {
    token: string;
    refreshToken?: string;
    expiresAt?: number;
    scopes?: string[];
    emails?: ProviderEmail[];
    selectedEmail?: string;
  };
}

/**
 * GitLab OAuth credential
 */
interface GitLabCredential extends BaseCredentialData {
  provider: 'gitlab';
  credentials: {
    token: string;
    refreshToken: string;
    expiresAt?: number;
    emails?: ProviderEmail[];
    selectedEmail?: string;
  };
}

/**
 * Custom PAT credential
 */
interface CustomCredential extends BaseCredentialData {
  provider: 'custom';
  credentials: {
    username: string;
    password: string; // Personal access token
    baseURI?: string; // For custom providers
  };
}

/**
 * Unified credential type (new structure)
 */
export type BaseGitCredentialsV2 = GitHubCredential | GitLabCredential | CustomCredential;

/**
 * Combined type supporting both legacy and new credential structures
 */
type BaseGitCredentials = BaseGitCredentialsV1 | BaseGitCredentialsV2;

/**
 * Type guard to check if credential is using new unified structure
 */
export function isGitCredentialsV2(gitCredential: GitCredentials): gitCredential is GitCredentialsV2 {
  return 'credentials' in gitCredential && gitCredential.credentials && typeof gitCredential.credentials === 'object';
}

/**
 * Type guard to check if credential is legacy structure
 */
export function isGitCredentialsV1(credential: GitCredentials): credential is GitCredentialsV1 {
  return !isGitCredentialsV2(credential);
}

/**
 * Type guard for OAuth credentials
 */
export function isOAuthCredential(
  credential: GitCredentials,
): credential is BaseModel & (GitHubCredential | GitLabCredential) {
  return isGitCredentialsV2(credential) && (credential.provider === 'github' || credential.provider === 'gitlab');
}

/**
 * Type guard for credentials that support renewal
 */
export function supportsRenewal(gitCredential: GitCredentials): boolean {
  if (!isGitCredentialsV2(gitCredential)) return false;
  if (gitCredential.provider === 'gitlab') {
    return !!gitCredential.credentials?.refreshToken;
  }
  if (gitCredential.provider === 'github') {
    return !!gitCredential.credentials?.refreshToken;
  }
  return false;
}
