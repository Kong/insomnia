import { createHash, randomBytes } from 'node:crypto';

import { shell } from 'electron';
import { net } from 'electron/main';
import type { GitAuth } from 'isomorphic-git';
import { v4 } from 'uuid';

import { getApiBaseURL, INSOMNIA_GITLAB_CLIENT_ID, INSOMNIA_GITLAB_REDIRECT_URI, PLAYWRIGHT } from '~/common/constants';
import * as models from '~/models';
import type { BaseGitCredentialsV2, GitCredentials } from '~/models/git-credentials';
import { isGitCredentialsV2 } from '~/models/git-credentials';

import type {
  GitLabProviderConfig,
  GitRemoteProvider,
  OAuthCompleteResult,
  OAuthInitResult,
  ProviderEmail,
  ProviderRepository,
  ProviderUser,
  ValidationResult,
} from './types';

/**
 * OAuth state cache for security validation with PKCE verifiers
 * Maps state -> code_verifier for GitLab PKCE flow
 */
const gitlabStatesCache = new Map<string, string>();

/**
 * Token renewal tracking to prevent infinite loops
 * Maps credential ID -> { attempts, lastAttempt }
 */
const renewalTracker = new Map<string, { attempts: number; lastAttempt: number }>();

// Renewal configuration
const MAX_RENEWAL_ATTEMPTS = 3;
const RENEWAL_COOLDOWN_MS = 60_000; // 1 minute cooldown between renewal attempts

/**
 * Get GitLab OAuth configuration
 */
async function getGitLabConfig() {
  // Validate and use the environment variables if provided
  if (
    (INSOMNIA_GITLAB_REDIRECT_URI && !INSOMNIA_GITLAB_CLIENT_ID) ||
    (!INSOMNIA_GITLAB_REDIRECT_URI && INSOMNIA_GITLAB_CLIENT_ID)
  ) {
    throw new Error('GitLab Client ID and Redirect URI must both be set.');
  }

  if (INSOMNIA_GITLAB_REDIRECT_URI && INSOMNIA_GITLAB_CLIENT_ID) {
    return {
      clientId: INSOMNIA_GITLAB_CLIENT_ID,
      redirectUri: INSOMNIA_GITLAB_REDIRECT_URI,
    };
  }

  const configResponse = await net.fetch(getApiBaseURL() + '/v1/oauth/gitlab/config', {
    method: 'GET',
  });

  const { applicationId: clientId, redirectUri } = (await configResponse.json()) as {
    applicationId: string;
    redirectUri: string;
  };

  return {
    clientId,
    redirectUri,
  };
}

/**
 * Base64 URL encode helper for PKCE
 */
function base64URLEncode(buffer: Buffer) {
  return buffer.toString('base64url');
}

/**
 * SHA256 hash helper for PKCE
 */
function sha256(str: string) {
  return createHash('sha256').update(str).digest();
}

/**
 * GitLab API Response Types
 */

interface GitLabProjectApiResponse {
  id: number;
  name: string;
  path_with_namespace: string;
  http_url_to_repo: string;
  default_branch: string;
  permissions?: {
    project_access?: {
      access_level: number;
    };
  };
}

interface GitLabEmailApiResponse {
  email: string;
}

interface GitLabUserApiResponse {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  email: string;
  public_email?: string;
  commit_email?: string;
}

interface GitLabOAuthTokenResponse {
  access_token: string;
  refresh_token: string;
}

/**
 * GitLab Provider
 *
 * Handles authentication and API interactions with GitLab.com and self-hosted GitLab instances.
 * Supports OAuth 2.0 authentication with refresh tokens, repository fetching, and email management.
 */
export class GitLabProvider implements GitRemoteProvider<GitLabProviderConfig> {
  readonly config: GitLabProviderConfig;
  readonly supportsOAuth = true;
  readonly supportsFetchRepos = false;
  readonly supportsFetchEmails = true;
  readonly supportsAutoRenew = true; // GitLab supports refresh tokens

  constructor(config: GitLabProviderConfig) {
    this.config = config;
  }

  /**
   * Validate if a URL is from this GitLab instance
   */
  async validateUrl(url: string): Promise<ValidationResult> {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      const instanceHostname = new URL(this.config.instanceUrl).hostname.toLowerCase();

      if (hostname === instanceHostname || hostname === `www.${instanceHostname}`) {
        return { valid: true };
      }

      return {
        valid: false,
        error: `URL must be from ${this.config.instanceUrl}`,
        suggestion: `Did you mean: https://${instanceHostname}${parsed.pathname}`,
      };
    } catch {
      return {
        valid: false,
        error: 'Invalid URL format',
      };
    }
  }

  /**
   * Fetch projects (repositories) accessible by the credential
   */
  async fetchRepositories(credential: GitCredentials): Promise<ProviderRepository[]> {
    if (!isGitCredentialsV2(credential) || credential.provider !== 'gitlab') {
      throw new Error('Invalid credential type for GitLab provider');
    }

    const repos: ProviderRepository[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await net.fetch(
        `${this.config.apiUrl}/projects?membership=true&per_page=${perPage}&page=${page}&order_by=last_activity_at`,
        {
          headers: {
            Authorization: `Bearer ${credential.credentials?.token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
      }

      const data = (await response.json()) as GitLabProjectApiResponse[];

      repos.push(
        ...data.map(project => ({
          id: String(project.id),
          name: project.name,
          fullName: project.path_with_namespace,
          cloneUrl: project.http_url_to_repo,
          defaultBranch: project.default_branch,
          permissions: {
            admin: (project.permissions?.project_access?.access_level ?? 0) >= 40, // Owner/Maintainer
            push: (project.permissions?.project_access?.access_level ?? 0) >= 30, // Developer+
            pull: (project.permissions?.project_access?.access_level ?? 0) >= 20, // Reporter+
          },
        })),
      );

      if (data.length < perPage) break;
      page++;
    }

    return repos;
  }

  /**
   * Fetch user emails from GitLab
   */
  async fetchUserEmails(credential: GitCredentials): Promise<ProviderEmail[]> {
    if (!isGitCredentialsV2(credential) || credential.provider !== 'gitlab') {
      throw new Error('Invalid credential type for GitLab provider');
    }

    const userData = await this.fetchUserWithToken(credential.credentials?.token);

    return this.fetchEmailsWithToken(credential.credentials?.token, userData);
  }

  /**
   * Fetch user info from GitLab
   * Used during OAuth completion to get user details
   */
  async fetchUser(credential: GitCredentials): Promise<ProviderUser> {
    if (!isGitCredentialsV2(credential) || credential.provider !== 'gitlab') {
      throw new Error('Invalid credential type for GitLab provider');
    }

    const data = await this.fetchUserWithToken(credential.credentials?.token);

    return {
      id: String(data.id),
      username: data.username,
      name: data.name || data.username,
      email: data.commit_email || data.email,
      avatarUrl: data.avatar_url,
    };
  }

  /**
   * Fetch user info with token directly
   */
  async fetchUserWithToken(token: string): Promise<GitLabUserApiResponse> {
    const response = await net.fetch(`${this.config.apiUrl}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('[gitlab] Failed to fetch gitlab user with token:', response.statusText);
      throw new Error(`GitLab API error: ${response.statusText}`);
    }

    return response.json() as Promise<GitLabUserApiResponse>;
  }

  /**
   * Fetch user's email addresses with token directly
   */
  async fetchEmailsWithToken(token: string, userData: GitLabUserApiResponse): Promise<ProviderEmail[]> {
    const emailsResponse = await net.fetch(`${this.config.apiUrl}/user/emails`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!emailsResponse.ok) {
      console.error('[gitlab] Failed to fetch gitlab user emails:', emailsResponse.statusText);
      return [
        {
          email: userData.commit_email || userData.email,
          primary: true,
          verified: true,
        },
      ];
    }

    const emailsData = (await emailsResponse.json()) as GitLabEmailApiResponse[];

    return emailsData.map(email => ({
      email: email.email,
      primary: email.email === userData.email,
      verified: true,
    }));
  }

  /**
   * Initiate OAuth flow with PKCE
   * Opens the browser to GitLab OAuth page and manages state for security
   */
  async initiateOAuth(): Promise<OAuthInitResult> {
    try {
      const state = v4();
      const verifier = base64URLEncode(randomBytes(32));
      gitlabStatesCache.set(state, verifier);

      const scopes = [
        // Needed to read the user's email address, username and avatar_url from the /user GitLab API
        'read_user',
        // Read/Write access to the user's projects to allow for syncing (push/pull etc.)
        'write_repository',
      ];

      const scope = scopes.join(' ');
      const challenge = base64URLEncode(sha256(verifier));

      const gitlabURL = new URL(`${this.config.instanceUrl}/oauth/authorize`);
      const { clientId, redirectUri } = await getGitLabConfig();

      gitlabURL.search = new URLSearchParams({
        client_id: clientId,
        scope,
        state,
        response_type: 'code',
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }).toString();

      await shell.openExternal(gitlabURL.toString());

      return {
        authUrl: gitlabURL.toString(),
        state,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to initiate the GitLab OAuth flow:', error);
      throw new Error(`Failed to initiate the GitLab OAuth flow: ${errorMessage}`);
    }
  }

  /**
   * Complete OAuth flow with PKCE
   * Exchanges code for token and creates/updates credential in database
   */
  async completeOAuth(code: string, state: string): Promise<OAuthCompleteResult> {
    try {
      // Validate state and get verifier for PKCE
      let verifier = gitlabStatesCache.get(state);

      if (PLAYWRIGHT) {
        verifier = 'test-verifier';
      }

      if (!verifier) {
        throw new Error('Invalid state parameter. It looks like the authorization flow was not initiated by the app.');
      }

      const { clientId, redirectUri } = await getGitLabConfig();
      const url = new URL(`${this.config.instanceUrl}/oauth/token`);

      url.search = new URLSearchParams({
        code,
        state,
        client_id: clientId,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }).toString();

      const gitLabResponse = await net.fetch(this.config.instanceUrl + url.pathname + url.search, {
        method: 'POST',
      });

      if (!gitLabResponse.ok) {
        throw new Error(`Failed to exchange code for token: ${gitLabResponse.statusText}`);
      }

      const { access_token, refresh_token } = (await gitLabResponse.json()) as GitLabOAuthTokenResponse;

      gitlabStatesCache.delete(state);

      // Fetch user details and emails
      const user = await this.fetchUserWithToken(access_token);
      const emails = await this.fetchEmailsWithToken(access_token, user);

      // Create or update credential in database
      const credentialData = {
        name: 'GitLab Credential',
        provider: 'gitlab',
        author: {
          email: user.commit_email ?? user.public_email ?? user.email ?? '',
          name: user.name || user.username || '',
          avatarUrl: user.avatar_url,
        },
        credentials: {
          token: access_token,
          refreshToken: refresh_token,
          emails,
        },
      } satisfies BaseGitCredentialsV2;

      const credential = await models.gitCredentials.create(credentialData);

      // Clear any renewal tracking since we have fresh tokens
      renewalTracker.delete(credential._id);

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete the GitLab OAuth flow';
      console.error('Failed to complete the GitLab OAuth flow:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Renew expired credential using refresh token
   */
  async renewCredential(credential: GitCredentials): Promise<GitCredentials> {
    if (!isGitCredentialsV2(credential) || credential.provider !== 'gitlab') {
      throw new Error('Invalid credential type for GitLab provider');
    }

    if (!credential.credentials?.refreshToken) {
      throw new Error('No refresh token available for renewal');
    }

    // Check renewal tracking to prevent infinite loops
    const tracker = renewalTracker.get(credential._id);
    const now = Date.now();

    if (tracker) {
      // Check if we're in cooldown period
      if (now - tracker.lastAttempt < RENEWAL_COOLDOWN_MS) {
        const remainingCooldown = Math.ceil((RENEWAL_COOLDOWN_MS - (now - tracker.lastAttempt)) / 1000);
        throw new Error(`Token renewal in cooldown. Try again in ${remainingCooldown} seconds.`);
      }

      // Check if we've exceeded max attempts
      if (tracker.attempts >= MAX_RENEWAL_ATTEMPTS) {
        // Reset after cooldown period has passed
        if (now - tracker.lastAttempt >= RENEWAL_COOLDOWN_MS) {
          renewalTracker.set(credential._id, { attempts: 1, lastAttempt: now });
        } else {
          throw new Error('Maximum token renewal attempts exceeded. Please sign in again.');
        }
      } else {
        // Increment attempts
        renewalTracker.set(credential._id, { attempts: tracker.attempts + 1, lastAttempt: now });
      }
    } else {
      // First attempt
      renewalTracker.set(credential._id, { attempts: 1, lastAttempt: now });
    }

    try {
      const { clientId, redirectUri } = await getGitLabConfig();
      const url = new URL(`${this.config.instanceUrl}/oauth/token`);

      url.search = new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: credential.credentials?.refreshToken,
        redirect_uri: redirectUri,
      }).toString();

      const response = await net.fetch(this.config.instanceUrl + url.pathname + url.search, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to refresh token: ${response.statusText} - ${errorText}`);
      }

      const { access_token, refresh_token } = (await response.json()) as GitLabOAuthTokenResponse;

      // Update the credential in the database with new tokens
      const updatedCredential = await models.gitCredentials.update(credential, {
        credentials: {
          token: access_token,
          refreshToken: refresh_token,
        },
      });

      // Reset renewal tracking on success
      renewalTracker.delete(credential._id);

      console.log('[GitLabProvider] Successfully renewed credential');
      return updatedCredential;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to renew credential';
      console.error('[GitLabProvider] Credential renewal failed:', error);
      throw new Error(`GitLab credential renewal failed: ${errorMessage}`);
    }
  }

  /**
   * Prepare auth callback for isomorphic-git
   * Converts GitLab OAuth token to format expected by isomorphic-git
   */
  authCallback(credential: GitCredentials): GitAuth {
    if (!isGitCredentialsV2(credential) || credential.provider !== 'gitlab') {
      throw new Error('Invalid credential type for GitLab provider');
    }

    // GitLab uses 'oauth2' as username and token as password
    // https://isomorphic-git.org/docs/en/authentication.html
    return {
      username: 'oauth2',
      password: credential.credentials?.token,
    };
  }

  /**
   * Prepare auth failure callback for isomorphic-git
   * Handles token refresh on authentication failures
   */
  async authFailureCallback(credential: GitCredentials): Promise<GitAuth> {
    console.log('[GitLabProvider] Authentication failed, attempting token renewal...');

    try {
      const renewed = await this.renewCredential(credential);
      if (isGitCredentialsV2(renewed) && renewed.provider === 'gitlab') {
        console.log('[GitLabProvider] Token renewed successfully');
        return {
          username: 'oauth2',
          password: renewed.credentials?.token,
        };
      }
    } catch (error) {
      console.error('[GitLabProvider] Failed to renew credential:', error);
    }

    // Return cancel to stop the operation if renewal fails
    return { cancel: true };
  }
}
