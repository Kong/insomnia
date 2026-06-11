import type { GitCredentials } from 'insomnia-data';
import { models } from 'insomnia-data';
import type { GitAuth } from 'isomorphic-git';

import type { CustomProviderConfig, GitRemoteProvider, ValidationResult } from './types';

const { isGitCredentialsV2 } = models.gitCredentials;

/**
 * Custom Provider
 *
 * Handles authentication for any Git server using Personal Access Tokens (PAT).
 * This is a generic provider for services like Bitbucket, Azure DevOps,
 * self-hosted Git servers, or any Git server with HTTP(S) basic auth.
 */
export class CustomProvider implements GitRemoteProvider<CustomProviderConfig> {
  readonly config: CustomProviderConfig;
  readonly supportsOAuth = false;
  readonly supportsFetchRepos = false;
  readonly supportsFetchEmails = false;
  readonly supportsAutoRenew = false;

  constructor(config: CustomProviderConfig) {
    this.config = config;
  }
  /**
   * Validate URL format
   * Accepts any valid Git URL since this is a generic provider
   */
  async validateUrl(url: string): Promise<ValidationResult> {
    try {
      const parsed = new URL(url);

      // Check if it's a valid HTTP(S) URL
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          valid: false,
          error: 'URL must use HTTP or HTTPS protocol',
          suggestion: `Try: https://${parsed.hostname}${parsed.pathname}`,
        };
      }

      // Check if URL ends with .git (recommended but not required)
      if (!url.endsWith('.git')) {
        return {
          valid: true,
          suggestion: 'Consider adding .git suffix to the URL for better compatibility',
        };
      }

      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'Invalid URL format',
      };
    }
  }

  /**
   * Prepare auth callback for isomorphic-git
   * Uses basic authentication with username and personal access token
   */
  authCallback(credential: GitCredentials): Promise<GitAuth> | GitAuth {
    if (!isGitCredentialsV2(credential) || credential.provider !== 'custom') {
      throw new Error('Invalid credential type for Custom provider');
    }

    // Basic auth: username and password (PAT)
    return {
      username: credential.credentials?.username,
      password: credential.credentials?.password,
    };
  }

  /**
   * Prepare auth failure callback for isomorphic-git
   * No auto-renewal for custom credentials - user must update manually
   */
  authFailureCallback(_credential: GitCredentials): GitAuth {
    console.log('[CustomProvider] Authentication failed. No auto-renewal available for custom credentials.');
    // Return cancel to stop the operation
    return { cancel: true };
  }
}
