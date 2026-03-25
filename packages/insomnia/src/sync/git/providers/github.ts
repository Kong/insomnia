import { shell } from 'electron';
import { net } from 'electron/main';
import type { GitAuth } from 'isomorphic-git';
import { v4 } from 'uuid';

import { getApiBaseURL, getAppWebsiteBaseURL, PLAYWRIGHT } from '~/common/constants';
import type { GitCredentials, GitCredentialsV2 } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';
import { expiresAtFromOAuthExpiresIn } from '~/sync/git/utils';

import type {
  GitHubProviderConfig,
  GitRemoteProvider,
  OAuthCompleteResult,
  OAuthInitResult,
  ProviderEmail,
  ProviderRepository,
  ProviderUser,
  ValidationResult,
} from './types';

const { isGitCredentialsV2 } = models.gitCredentials;

/**
 * OAuth state cache for security validation
 * Stores states that are generated for the OAuth flow to verify callback legitimacy
 */
const githubStatesCache = new Set<string>();

type GitHubCredentialV2 = Extract<GitCredentialsV2, { provider: 'github' }>;

/**
 * GitHub API Response Types
 */

interface GitHubRepositoryApiResponse {
  id: number;
  name: string;
  full_name: string;
  clone_url: string;
  default_branch: string;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

interface GitHubEmailApiResponse {
  email: string;
  primary: boolean;
  verified: boolean;
}

interface GitHubUserApiResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubOAuthTokenResponse {
  access_token: string;
  /** Seconds until access token expires — only present if the token issuer returns it (not always for GitHub). */
  expires_in?: number;
}

/**
 * GitHub Provider
 *
 * Handles authentication and API interactions with GitHub.com and GitHub Enterprise.
 * Supports OAuth 2.0 authentication, repository fetching, and email management.
 */
export class GitHubProvider implements GitRemoteProvider<GitHubProviderConfig> {
  readonly config: GitHubProviderConfig;
  readonly supportsOAuth = true;
  readonly supportsFetchRepos = true;
  readonly supportsFetchEmails = true;
  readonly supportsAutoRenew = false; // GitHub OAuth Apps don't support refresh tokens yet

  constructor(config: GitHubProviderConfig) {
    this.config = config;
  }

  private repositoryCache = new Map<string, ProviderRepository[]>();

  /**
   * Validate if a URL is from this GitHub instance
   */
  async validateUrl(url: string): Promise<ValidationResult> {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      const webHostname = new URL(this.config.webUrl).hostname.toLowerCase();

      if (hostname === webHostname || hostname === `www.${webHostname}`) {
        return { valid: true };
      }

      return {
        valid: false,
        error: `URL must be from ${this.config.webUrl}`,
        suggestion: `Did you mean: https://${webHostname}${parsed.pathname}`,
      };
    } catch {
      return {
        valid: false,
        error: 'Invalid URL format',
      };
    }
  }

  /**
   * Fetch repositories accessible by the credential
   */
  async fetchRepositories(credentials: GitCredentials, refresh?: boolean): Promise<ProviderRepository[]> {
    if (!isGitCredentialsV2(credentials) || credentials.provider !== 'github') {
      throw new Error('Invalid credential type for GitHub provider');
    }

    if (
      !refresh &&
      this.repositoryCache.has(credentials._id) &&
      this.repositoryCache.get(credentials._id)?.length &&
      this.repositoryCache.get(credentials._id)!.length > 0
    ) {
      return this.repositoryCache.get(credentials._id)!;
    }

    const repos: ProviderRepository[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await net.fetch(
        `${this.config.apiUrl}/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
        {
          headers: {
            Authorization: `token ${credentials.credentials?.token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data = (await response.json()) as GitHubRepositoryApiResponse[];

      repos.push(
        ...data
          .filter(repo => repo.permissions?.pull)
          .map(repo => ({
            id: String(repo.id),
            name: repo.name,
            fullName: repo.full_name,
            cloneUrl: repo.clone_url,
            defaultBranch: repo.default_branch,
            permissions: {
              admin: repo.permissions?.admin || false,
              push: repo.permissions?.push || false,
              pull: repo.permissions?.pull || false,
            },
          })),
      );

      if (data.length < perPage) break;
      page++;
    }

    this.repositoryCache.set(credentials._id, repos);

    return repos;
  }

  /**
   * Fetch user emails from GitHub
   */
  async fetchUserEmails(credential: GitCredentials): Promise<ProviderEmail[]> {
    if (!isGitCredentialsV2(credential) || credential.provider !== 'github') {
      throw new Error('Invalid credential type for GitHub provider');
    }

    return this.fetchEmails(credential.credentials.token);
  }

  /**
   * Fetch user info from GitHub
   * Used during OAuth completion to get user details
   */
  async fetchUser(token: string): Promise<ProviderUser> {
    const response = await net.fetch(`${this.config.apiUrl}/user`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubUserApiResponse;

    return {
      id: String(data.id),
      username: data.login,
      name: data.name || data.login,
      email: data.email || undefined,
      avatarUrl: data.avatar_url,
    };
  }

  /**
   * Fetch user emails from GitHub with token
   * Convenience method that accepts a token directly
   */
  async fetchEmails(token: string): Promise<ProviderEmail[]> {
    const response = await net.fetch(`${this.config.apiUrl}/user/emails`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubEmailApiResponse[];

    return data.map(email => ({
      email: email.email,
      primary: email.primary,
      verified: email.verified,
    }));
  }

  /**
   * Initiate OAuth flow
   * Opens the browser to GitHub OAuth page and manages state for security
   */
  async initiateOAuth(): Promise<OAuthInitResult> {
    try {
      const state = v4();
      githubStatesCache.add(state);
      const url = new URL(getAppWebsiteBaseURL() + '/oauth/github-app');

      url.search = new URLSearchParams({
        state,
      }).toString();

      await shell.openExternal(url.toString());

      return {
        authUrl: url.toString(),
        state,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to initiate the GitHub OAuth flow:', error);
      throw new Error(`Failed to initiate the GitHub OAuth flow: ${errorMessage}`);
    }
  }

  /**
   * Complete OAuth flow
   * Exchanges code for token and creates/updates credential in database
   */
  async completeOAuth(code: string, state: string): Promise<OAuthCompleteResult> {
    try {
      // Validate state for security (CSRF protection)
      if (!PLAYWRIGHT && !githubStatesCache.has(state)) {
        throw new Error('Invalid state parameter. It looks like the authorization flow was not initiated by the app.');
      }

      // Exchange code for access token via Insomnia backend
      const response = await net.fetch(getApiBaseURL() + '/v1/oauth/github-app', {
        method: 'POST',
        body: JSON.stringify({
          code,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to exchange code for token: ${response.statusText}`);
      }

      const data = (await response.json()) as GitHubOAuthTokenResponse;
      const accessTokenExpiresAt = expiresAtFromOAuthExpiresIn(data.expires_in);
      githubStatesCache.delete(state);

      // Fetch user details
      const [emails, user] = await Promise.all([
        this.fetchEmails(data.access_token),
        this.fetchUser(data.access_token),
      ]);

      const userProfileEmail = user.email ?? '';
      const email = emails.find(e => e.primary)?.email ?? userProfileEmail ?? '';

      const author = {
        email,
        name: user.name || user.username,
        avatarUrl: user.avatarUrl,
      };

      const credentials = {
        token: data.access_token,
        emails,
        // Ensure the credential has a selectedEmail for consistent matching later.
        selectedEmail: email || undefined,
        ...(accessTokenExpiresAt !== undefined ? { expiresAt: accessTokenExpiresAt } : {}),
      };

      // Upsert: update the existing GitHub credential when we can reliably identify it.
      // Otherwise, create a new credential to avoid overwriting a different account.
      const existingGitHubCredentials = (await services.gitCredentials.all()).filter(
        (c): c is GitHubCredentialV2 => isGitCredentialsV2(c) && c.provider === 'github',
      );

      const matchingByEmail = email
        ? existingGitHubCredentials
            .filter(c => {
              return (
                c.author.email === email ||
                c.credentials.selectedEmail === email ||
                c.credentials.emails?.some(e => e.email === email)
              );
            })
            .sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0))
        : [];

      const existing =
        matchingByEmail[0] || (existingGitHubCredentials.length === 1 ? existingGitHubCredentials[0] : undefined);

      await (existing
        ? services.gitCredentials.update(existing, {
            name: 'GitHub Credential',
            author,
            credentials: {
              ...existing.credentials,
              token: data.access_token,
              emails,
              selectedEmail: email || existing.credentials.selectedEmail,
              ...(accessTokenExpiresAt !== undefined ? { expiresAt: accessTokenExpiresAt } : {}),
            },
          })
        : services.gitCredentials.create({
            name: 'GitHub Credential',
            credentials,
            provider: 'github',
            author,
          }));

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete the GitHub OAuth flow';
      console.error('Failed to complete the GitHub OAuth flow:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Prepare auth callback for isomorphic-git
   * Converts GitHub OAuth token to format expected by isomorphic-git
   */
  authCallback(credential: GitCredentials): GitAuth {
    if (!isGitCredentialsV2(credential) || credential.provider !== 'github') {
      throw new Error('Invalid credential type for GitHub provider');
    }

    // GitHub requires token as username with x-oauth-basic as password
    // https://isomorphic-git.org/docs/en/authentication.html
    return {
      username: credential?.credentials?.token,
      password: 'x-oauth-basic',
    };
  }

  /**
   * Prepare auth failure callback for isomorphic-git
   * Handles token refresh on authentication failures
   */
  authFailureCallback(): GitAuth {
    console.log('[GitHubProvider] Authentication failed, but no auto-renewal available');
    // GitHub OAuth Apps don't support refresh tokens
    // Return cancel to stop the operation
    return { cancel: true };
  }
}
