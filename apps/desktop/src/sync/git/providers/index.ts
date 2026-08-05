/**
 * Git Remote Providers Module
 *
 * This module provides a unified system for handling Git authentication
 * across different Git hosting providers (GitHub, GitLab, etc.)
 *
 * Main exports:
 * - gitRemoteProviderRegistry: Singleton registry of all providers
 * - initializeGitRemoteProviders: Initialize built-in providers
 * - Provider classes: GitHubProvider, GitLabProvider, CustomProvider, LocalProvider
 * - Types: All TypeScript interfaces and types
 */

// Export types
export type {
  GitRemoteProviderType,
  BaseProviderConfig,
  GitHubProviderConfig,
  GitLabProviderConfig,
  CustomProviderConfig,
  NativeProviderConfig,
  GitRemoteProviderConfig,
  GitRemoteProvider,
  OAuthInitResult,
  OAuthCompleteResult,
  ProviderEmail,
  ProviderRepository,
  ProviderUser,
  ValidationResult,
} from './types';

// Export registry class
export { GitRemoteProviderRegistry } from './registry';

// Export provider implementations
export { GitHubProvider } from './github';
export { GitLabProvider } from './gitlab';
export { CustomProvider } from './custom';
export { NativeProvider } from './native';

import { getGitHubRestApiUrl } from '~/common/constants';

// Import for initialization
import { CustomProvider } from './custom';
import { GitHubProvider } from './github';
import { GitLabProvider } from './gitlab';
import { NativeProvider } from './native';
import { GitRemoteProviderRegistry } from './registry';

/**
 * Singleton instance of the provider registry
 * Use this instance throughout the application
 */
export const gitRemoteProviderRegistry = new GitRemoteProviderRegistry();

/**
 * Initialize built-in Git remote providers
 *
 * This function registers all built-in providers (GitHub, GitLab, Custom, Local)
 * with the singleton registry. Call this once during app initialization.
 */
export function initializeGitRemoteProviders(): void {
  console.log('[Git Providers] Initializing Git remote providers...');

  // Register GitHub provider
  gitRemoteProviderRegistry.register(
    new GitHubProvider({
      type: 'github',
      displayName: 'GitHub',
      description: 'GitHub and GitHub Enterprise',
      iconName: ['fab', 'github'],
      apiUrl: getGitHubRestApiUrl(),
      webUrl: 'https://github.com',
    }),
  );

  // Register GitLab provider
  gitRemoteProviderRegistry.register(
    new GitLabProvider({
      type: 'gitlab',
      displayName: 'GitLab',
      description: 'GitLab.com and self-hosted GitLab',
      iconName: ['fab', 'gitlab'],
      instanceUrl: 'https://gitlab.com',
      apiUrl: 'https://gitlab.com/api/v4',
    }),
  );

  // Register Custom provider (for PATs)
  gitRemoteProviderRegistry.register(
    new CustomProvider({
      type: 'custom',
      displayName: 'Access Token',
      description: 'Any Git server with personal access token',
      iconName: 'key',
    }),
  );

  // Register Native provider (system git credential manager)
  gitRemoteProviderRegistry.register(
    new NativeProvider({
      type: 'native',
      displayName: 'System Git Credentials',
      description: 'Use the credentials configured in your system git credential manager',
      iconName: ['fab', 'git-alt'],
    }),
  );

  const providers = gitRemoteProviderRegistry.getAll();
  console.log(
    `[Git Providers] Initialized ${providers.length} providers:`,
    providers.map(p => p.config.type).join(', '),
  );
}
