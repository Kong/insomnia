import { database as db } from '../common/database';
import type { BaseModel } from './index';

export type OauthProviderName = 'gitlab' | 'github';

// New unified provider types
export type GitRemoteProviderType = 'github' | 'gitlab' | 'custom';

export type GitCredentials = BaseModel & BaseGitCredentials;

export const name = 'Git Credentials';

export const type = 'GitCredentials';

export const prefix = 'git_creds';

export const canDuplicate = false;

export const canSync = false;

export function init(): BaseGitCredentials {
  return {
    token: '',
    refreshToken: '',
    provider: 'github',
    author: {
      email: '',
      name: '',
      avatarUrl: '',
    },
    baseURI: '',
    name: '',
    renewalAttempts: 0,
  };
}

/**
 * Legacy git credentials interface (for backward compatibility)
 * @deprecated Use the new provider-specific credential types
 */
interface LegacyGitCredentials {
  token: string;
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
  baseURI?: string;
  renewalAttempts: number;
  lastRenewalAttempt?: number;
}

/**
 * GitHub OAuth credential
 */
interface GitHubCredential extends BaseCredentialData {
  provider: 'github';
  token: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes?: string[];
  emails?: ProviderEmail[];
  selectedEmail?: string;
}

/**
 * GitLab OAuth credential
 */
interface GitLabCredential extends BaseCredentialData {
  provider: 'gitlab';
  token: string;
  refreshToken: string;
  expiresAt: number;
  emails?: ProviderEmail[];
  selectedEmail?: string;
}

/**
 * Custom PAT credential
 */
interface CustomCredential extends BaseCredentialData {
  provider: 'custom';
  username: string;
  password: string; // Personal access token
  baseURI?: string; // For custom providers
}

/**
 * Unified credential type (new structure)
 */
type GitCredential = GitHubCredential | GitLabCredential | CustomCredential;

/**
 * Combined type supporting both legacy and new credential structures
 */
type BaseGitCredentials = LegacyGitCredentials | GitCredential;

/**
 * Type guard to check if credential is using new unified structure
 */
export function isGitCredential(credential: GitCredentials): credential is BaseModel & GitCredential {
  return 'name' in credential && typeof credential.name === 'string' && 'renewalAttempts' in credential;
}

/**
 * Type guard to check if credential is legacy structure
 */
export function isLegacyCredential(credential: GitCredentials): credential is BaseModel & LegacyGitCredentials {
  return !isGitCredential(credential);
}

/**
 * Migrate legacy credential to new unified structure
 */
export function migrate(doc: GitCredentials): GitCredentials {
  return doc;
}

export function create(patch: Partial<GitCredentials> = {}) {
  return db.docCreate<GitCredentials>(type, patch);
}

export async function getById(id: string) {
  const doc = await db.findOne<GitCredentials>(type, { _id: id });
  return doc ? migrate(doc) : null;
}

export function update(credentials: GitCredentials, patch: Partial<GitCredentials>) {
  return db.docUpdate<GitCredentials>(credentials, patch);
}

export function remove(credentials: GitCredentials) {
  return db.remove(credentials);
}

export async function all() {
  const docs = await db.find<GitCredentials>(type);
  return docs.map(migrate);
}

export function removeAll() {
  return db.removeWhere<GitCredentials>(type, {});
}

/**
 * Type guard for OAuth credentials
 */
export function isOAuthCredential(
  credential: GitCredentials,
): credential is BaseModel & (GitHubCredential | GitLabCredential) {
  return isGitCredential(credential) && (credential.provider === 'github' || credential.provider === 'gitlab');
}

/**
 * Type guard for credentials that support renewal
 */
export function supportsRenewal(credential: GitCredentials): boolean {
  if (!isGitCredential(credential)) return false;
  if (credential.provider === 'gitlab') {
    return !!credential.refreshToken;
  }
  if (credential.provider === 'github') {
    return !!credential.refreshToken;
  }
  return false;
}
