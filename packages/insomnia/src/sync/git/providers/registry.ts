import type { GitProviderOption, GitRemoteProvider, GitRemoteProviderType, ValidationResult } from './types';

// Re-export types from git-credentials model for convenience
export type {
  GitCredentials as GitCredentialData,
  GitRemoteProviderType,
  ProviderEmail,
} from '~/models/git-credentials';

export class GitRemoteProviderRegistry {
  private providers = new Map<GitRemoteProviderType, GitRemoteProvider>();

  /**
   * Register a provider
   */
  register(provider: GitRemoteProvider): void {
    const type = provider.config.type;
    if (this.providers.has(type)) {
      console.warn(`[GitRemoteProviderRegistry] Provider '${type}' is already registered, overwriting`);
    }
    this.providers.set(type, provider);
  }

  /**
   * Get provider by type
   */
  get(type: GitRemoteProviderType): GitRemoteProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Get provider by type (throws if not found)
   */
  getOrThrow(type: GitRemoteProviderType): GitRemoteProvider {
    const provider = this.get(type);
    if (!provider) {
      throw new Error(`Provider '${type}' is not registered`);
    }
    return provider;
  }

  /**
   * Check if provider exists
   */
  has(type: GitRemoteProviderType): boolean {
    return this.providers.has(type);
  }

  /**
   * Get all registered providers
   */
  getAll(): GitRemoteProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * List provider options for UI
   */
  listProviderOptions(): GitProviderOption[] {
    return this.getAll().map(provider => ({
      id: provider.config.type,
      type: provider.config.type,
      displayName: provider.config.displayName,
      description: provider.config.description,
      iconName: provider.config.iconName,
      supportsOAuth: provider.supportsOAuth,
      supportsFetchRepos: provider.supportsFetchRepos,
      supportsFetchEmails: provider.supportsFetchEmails,
      supportsAutoRenew: provider.supportsAutoRenew,
    }));
  }

  /**
   * Validate URL against a specific provider
   */
  async validateUrl(type: GitRemoteProviderType, url: string): Promise<ValidationResult> {
    const provider = this.get(type);
    if (!provider) {
      return {
        valid: false,
        error: `Provider '${type}' is not registered`,
      };
    }
    return provider.validateUrl(url);
  }

  /**
   * Find the best provider for a given URL
   * Returns undefined if no provider can handle the URL
   */
  async detectProviderForUrl(url: string): Promise<GitRemoteProviderType | undefined> {
    for (const provider of this.getAll()) {
      const result = await provider.validateUrl(url);
      if (result.valid) {
        return provider.config.type;
      }
    }
    return undefined;
  }
}
