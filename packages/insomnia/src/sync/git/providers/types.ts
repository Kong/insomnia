import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import type { GitCredentials } from 'insomnia-data';
import type { GitAuth } from 'isomorphic-git';

/**
 * Supported Git remote provider types
 */
export type GitRemoteProviderType = 'github' | 'gitlab' | 'custom';

/**
 * Base configuration for all providers
 */
export interface BaseProviderConfig {
  type: GitRemoteProviderType;
  displayName: string;
  description?: string;
  iconName?: IconProp; // For UI rendering
}

/**
 * GitHub provider configuration
 * Supports both github.com and GitHub Enterprise
 */
export interface GitHubProviderConfig extends BaseProviderConfig {
  type: 'github';
  apiUrl: string; // 'api.github.com' or GHE API URL
  webUrl: string; // 'github.com' or GHE web URL
}

/**
 * GitLab provider configuration
 * Supports both gitlab.com and self-hosted GitLab
 */
export interface GitLabProviderConfig extends BaseProviderConfig {
  type: 'gitlab';
  instanceUrl: string; // 'gitlab.com' or self-hosted URL
  apiUrl: string; // API endpoint
}

/**
 * Custom PAT provider configuration
 * For any Git server with basic auth
 */
export interface CustomProviderConfig extends BaseProviderConfig {
  type: 'custom';
}

/**
 * Discriminated union of all provider configs
 */
export type GitRemoteProviderConfig = GitHubProviderConfig | GitLabProviderConfig | CustomProviderConfig;

/**
 * OAuth initialization result
 */
export interface OAuthInitResult {
  authUrl: string; // URL to redirect user to
  state: string; // OAuth state for verification
}

/**
 * OAuth completion result
 */
export interface OAuthCompleteResult {
  success: boolean;
  error?: string;
}

/**
 * User email from provider
 */
export interface ProviderEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * Repository info from provider
 */
export interface ProviderRepository {
  id: string;
  name: string;
  fullName: string; // e.g., "Kong/insomnia"
  cloneUrl: string;
  defaultBranch?: string;
  permissions: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

/**
 * User info from provider
 */
export interface ProviderUser {
  id: string;
  username: string;
  name: string;
  email?: string; // Primary email
  avatarUrl?: string;
}

/**
 * URL validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string; // Suggested fix if invalid
}

/**
 * Git Remote Provider interface
 * All providers must implement this interface
 */
export interface GitRemoteProvider<TConfig extends BaseProviderConfig = BaseProviderConfig> {
  /** Provider configuration */
  readonly config: TConfig;

  /** Capabilities */
  readonly supportsOAuth: boolean;
  readonly supportsFetchRepos: boolean;
  readonly supportsFetchEmails: boolean;
  readonly supportsAutoRenew: boolean;

  /**
   * Validate if a Git URL is compatible with this provider
   */
  validateUrl(url: string): Promise<ValidationResult>;

  /**
   * Validate that a credential is currently accepted by the remote provider.
   * Should throw an error starting with `HTTP Error: 4xx` on auth failures so
   * the re-auth banner can detect it.  Falls back to `fetchRemoteBranches` for
   * providers that don't implement this method.
   */
  validateCredentials?(credential: GitCredentials): Promise<void>;

  /**
   * Fetch repositories accessible by the credential
   * Only for providers that support it (GitHub, GitLab)
   */
  fetchRepositories?(credential: any, refresh?: boolean): Promise<ProviderRepository[]>;

  /**
   * Fetch user emails from the provider
   * Only for providers that support it (GitHub, GitLab)
   */
  fetchUserEmails?(credential: any): Promise<ProviderEmail[]>;

  /**
   * Fetch user information from the provider
   * Only for providers that support it (GitHub, GitLab)
   */
  fetchUser?(credential: any): Promise<ProviderUser>;

  /**
   * Initiate OAuth flow
   * Only for providers that support OAuth
   */
  initiateOAuth?(): Promise<OAuthInitResult>;

  /**
   * Complete OAuth flow
   * Only for providers that support OAuth
   */
  completeOAuth?(code: string, state: string): Promise<OAuthCompleteResult>;

  /**
   * Renew expired credential
   * Only for providers that support auto-renewal
   */
  renewCredential?(credential: any): Promise<any>;

  /**
   * Prepare auth callback for isomorphic-git
   * Converts credential to format expected by isomorphic-git
   */
  authCallback(credential: GitCredentials): Promise<GitAuth> | GitAuth;

  /**
   * Prepare auth failure callback for isomorphic-git
   * Handles token refresh on auth failures
   */
  authFailureCallback(credential: any): Promise<GitAuth> | GitAuth | void | Promise<void>;
}

export interface GitProviderOption {
  id: GitRemoteProviderType;
  type: GitRemoteProviderType;
  displayName: string;
  description?: string;
  iconName?: IconProp;
  supportsOAuth: boolean;
  supportsFetchRepos: boolean;
  supportsFetchEmails: boolean;
  supportsAutoRenew: boolean;
}
