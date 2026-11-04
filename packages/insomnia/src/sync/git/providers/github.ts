import { BrowserWindow, clipboard, shell } from 'electron';
import { net } from 'electron/main';
import type { GitCredentials, GitCredentialsV2 } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import type { GitAuth } from 'isomorphic-git';
import { v4 } from 'uuid';

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
 * Stores states that are generated for the OAuth flow to verify callback legitimacy,
 * mapped to the credential ID being reauthorized (undefined when adding a fresh credential).
 */
const GITHUB_OAUTH_SCOPES = 'repo read:user user:email';
const GITHUB_OAUTH_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

const githubStatesCache = new Map<string, { credentialId?: string; token: Promise<GitHubDeviceToken> }>();

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

type GitHubDeviceToken = GitHubOAuthTokenResponse & { access_token: string };

interface GitHubDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface GitHubOAuthTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
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
   * Validate credentials against the GitHub API.
   * Hits `GET /user` — lightweight and authoritative: returns 401 when the
   * token is revoked or the GitHub App has been uninstalled.
   */
  async validateCredentials(credential: GitCredentials): Promise<void> {
    if (!isGitCredentialsV2(credential) || credential.provider !== 'github') {
      throw new Error('Invalid credential type for GitHub provider');
    }

    const response = await net.fetch(`${this.config.apiUrl}/user`, {
      headers: {
        Authorization: `token ${credential.credentials.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
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
   * Uses the device flow, which needs no client secret or redirect
   */
  async initiateOAuth(credentialId?: string): Promise<OAuthInitResult> {
    try {
      const { gitHubClientId: clientId } = await services.settings.get();
      if (!clientId) {
        throw new Error(
          'GitHub sign-in needs a client ID. Add one in Preferences > Credentials, or use a personal access token.',
        );
      }

      const response = await net.fetch(`${this.config.webUrl}/login/device/code`, {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId, scope: GITHUB_OAUTH_SCOPES }),
        headers: GITHUB_OAUTH_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      const device = (await response.json()) as GitHubDeviceCodeResponse;

      const state = v4();
      const token = this.pollForDeviceToken(clientId, device);
      githubStatesCache.set(state, { credentialId, token });
      token
        .then(() => {
          const params = new URLSearchParams({ code: 'device', state });
          BrowserWindow.getAllWindows()[0]?.webContents.send(
            'shell:open',
            `restless://oauth/github/authenticate?${params}`,
          );
        })
        .catch(error => {
          githubStatesCache.delete(state);
          console.error('GitHub authorization failed:', error);
        });

      clipboard.writeText(device.user_code);
      BrowserWindow.getAllWindows()[0]?.webContents.send('git-device-code', device.user_code);
      await shell.openExternal(device.verification_uri);

      return {
        authUrl: device.verification_uri,
        state,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to initiate the GitHub OAuth flow:', error);
      throw new Error(`Failed to initiate the GitHub OAuth flow: ${errorMessage}`);
    }
  }

  private async pollForDeviceToken(clientId: string, device: GitHubDeviceCodeResponse) {
    const deadline = Date.now() + device.expires_in * 1000;
    let intervalMs = device.interval * 1000;

    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      const response = await net.fetch(`${this.config.webUrl}/login/oauth/access_token`, {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientId,
          device_code: device.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
        headers: GITHUB_OAUTH_HEADERS,
      });
      const data = (await response.json()) as GitHubOAuthTokenResponse;
      if (data.access_token) {
        return data as GitHubDeviceToken;
      }
      if (data.error === 'slow_down') {
        intervalMs += 5000;
      } else if (data.error !== 'authorization_pending') {
        throw new Error(data.error_description || data.error || 'Authorization failed');
      }
    }
    throw new Error('The GitHub device code expired');
  }

  /**
   * Complete OAuth flow
   * Reads the device flow token and creates/updates credential in database
   */
  async completeOAuth(_code: string, state: string): Promise<OAuthCompleteResult> {
    try {
      // Validate state for security (CSRF protection)
      const pending = githubStatesCache.get(state);
      if (!pending) {
        throw new Error('Invalid state parameter. It looks like the authorization flow was not initiated by the app.');
      }
      const reauthorizingCredentialId = pending.credentialId;
      const data = await pending.token;
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
        selectedEmail: email || undefined,
        ...(accessTokenExpiresAt !== undefined ? { expiresAt: accessTokenExpiresAt } : {}),
      };

      // Update the credential this flow was explicitly reauthorizing (see
      // GitEditProviderOAuthForm's "Reauthorize" button), if any. Otherwise this is
      // an "Add Credential" flow, so always create a new credential — never guess
      // at an existing one to update, or a second account for this provider could
      // silently overwrite the first.
      const existingCredential = reauthorizingCredentialId
        ? await services.gitCredentials.getById(reauthorizingCredentialId)
        : null;
      const existing: GitHubCredentialV2 | undefined =
        existingCredential && isGitCredentialsV2(existingCredential) && existingCredential.provider === 'github'
          ? existingCredential
          : undefined;

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
  authCallback(credential: GitCredentials, _url?: string, _repoPath?: string): GitAuth {
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
