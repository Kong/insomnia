import { createHash, randomBytes } from 'node:crypto';

import { shell } from 'electron';
import { net } from 'electron/main';
import type { GitAuth } from 'isomorphic-git';
import { v4 } from 'uuid';

import {
  getApiBaseURL,
  INSOMNIA_BITBUCKET_CLIENT_ID,
  INSOMNIA_BITBUCKET_REDIRECT_URI,
  PLAYWRIGHT,
} from '~/common/constants';
import * as models from '~/models';
import type { GitCredentialsV2 } from '~/models/git-credentials';
import { isGitCredentialsV2 } from '~/models/git-credentials';
import { base64decode } from '~/utils/vault';

import type {
  BitbucketProviderConfig,
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
 * Maps state -> code_verifier for Bitbucket PKCE flow
 */
const bitbucketStatesCache = new Map<string, string>();

/**
 * Token renewal tracking to prevent infinite loops
 * Maps credential ID -> { attempts, lastAttempt }
 */
const renewalTracker = new Map<string, { attempts: number; lastAttempt: number }>();

// Renewal configuration
const MAX_RENEWAL_ATTEMPTS = 3;
const RENEWAL_COOLDOWN_MS = 60_000; // 1 minute cooldown between renewal attempts

/**
 * Get Bitbucket OAuth configuration
 */
async function getBitbucketConfig() {
  // Validate and use the environment variables if provided
  if (
    (INSOMNIA_BITBUCKET_REDIRECT_URI && !INSOMNIA_BITBUCKET_CLIENT_ID) ||
    (!INSOMNIA_BITBUCKET_REDIRECT_URI && INSOMNIA_BITBUCKET_CLIENT_ID)
  ) {
    throw new Error('Bitbucket Client ID and Redirect URI must both be set.');
  }

  if (INSOMNIA_BITBUCKET_REDIRECT_URI && INSOMNIA_BITBUCKET_CLIENT_ID) {
    return {
      clientId: INSOMNIA_BITBUCKET_CLIENT_ID,
      redirectUri: INSOMNIA_BITBUCKET_REDIRECT_URI,
    };
  }

  // TODO: get config from serverside
  /* const configResponse = await net.fetch(getApiBaseURL() + '/v1/oauth/bitbucket/config', {
    method: 'GET',
  });

  const { applicationId: clientId, redirectUri } = (await configResponse.json()) as {
    applicationId: string;
    redirectUri: string;
  }; */

  const { clientId, redirectUri } = {
    clientId: 'zKFPbDfgRrcceWLk2Y',
    redirectUri: 'http://localhost:8080/oauth/redirect',
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
 * Bitbucket API Response Types
 */

interface BitbucketWorkspaceApiResponse {
  values: {
    workspace: {
      slug: string;
    };
  }[];
  next?: string;
}

interface BitbucketRepoApiResponse {
  values: {
    links: {
      clone: {
        name: 'https';
        href: string;
      }[];
    };
    full_name: string;
    name: string;
    mainbranch: {
      name: string;
      type: 'branch';
    };
    uuid: string;
  }[];
  next?: string;
}

interface BitbucketEmailApiResponse {
  values: {
    email: string;
    is_primary: boolean;
    is_confirmed: boolean;
  }[];
}

interface BitbucketUserApiResponse {
  display_name: string;
  username: string;
  account_id: string;
  links: {
    avatar: { href: string };
  };
}

interface BitbucketOAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

const repoUrlHostname = 'bitbucket.org';

/**
 * Bitbucket Provider
 *
 * Handles authentication and API interactions with Bitbucket.com and self-hosted Bitbucket instances.
 * Supports OAuth 2.0 authentication with refresh tokens, repository fetching, and email management.
 */
export class BitbucketProvider implements GitRemoteProvider<BitbucketProviderConfig> {
  readonly config: BitbucketProviderConfig;
  readonly supportsOAuth = true;
  readonly supportsFetchRepos = true;
  readonly supportsFetchEmails = true;
  readonly supportsAutoRenew = true; // Bitbucket supports refresh tokens

  constructor(config: BitbucketProviderConfig) {
    this.config = config;
  }

  private repositoryCache = new Map<string, ProviderRepository[]>();

  /**
   * Validate if a URL is from this Bitbucket instance
   */
  async validateUrl(url: string): Promise<ValidationResult> {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      const instanceHostname = repoUrlHostname;

      if (hostname === instanceHostname || hostname === `www.${instanceHostname}`) {
        return { valid: true };
      }

      return {
        valid: false,
        error: `URL must be from ${repoUrlHostname}`,
        suggestion: `Did you mean: https://${repoUrlHostname}${parsed.pathname}`,
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
  async fetchRepositories(gitCredentials: GitCredentialsV2, refresh?: boolean): Promise<ProviderRepository[]> {
    if (!isGitCredentialsV2(gitCredentials) || gitCredentials.provider !== 'bitbucket') {
      throw new Error('Invalid credential type for Bitbucket provider');
    }

    if (
      !refresh &&
      this.repositoryCache.has(gitCredentials._id) &&
      this.repositoryCache.get(gitCredentials._id)?.length &&
      this.repositoryCache.get(gitCredentials._id)!.length > 0
    ) {
      return this.repositoryCache.get(gitCredentials._id)!;
    }

    // TODO: test pagination
    const repos: ProviderRepository[] = [];
    let nextRepoUrl = '';
    while (true) {
      const response = await net.fetch(
        nextRepoUrl ? nextRepoUrl : 'https://api.bitbucket.org/2.0/repositories?role=contributor',
        {
          headers: {
            Authorization: `Bearer ${gitCredentials.credentials.token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Bitbucket API error: ${response.statusText}`);
      }

      const data = (await response.json()) as BitbucketRepoApiResponse;
      for (const repo of data.values) {
        const {
          uuid,
          full_name,
          name,
          links: { clone },
          mainbranch,
        } = repo;
        repos.push({
          id: uuid,
          name,
          fullName: full_name,
          cloneUrl: clone.find(({ name }) => name === 'https')?.href || '',
          defaultBranch: mainbranch.name,
          permissions: {
            admin: false,
            push: true,
            pull: true,
          },
        });
      }

      if (!data.next) {
        break;
      } else {
        nextRepoUrl = data.next;
      }
    }

    this.repositoryCache.set(gitCredentials._id, repos);

    return repos;
  }

  /**
   * Fetch user emails from Bitbucket
   */
  async fetchUserEmailsWithToken(token: string): Promise<ProviderEmail[]> {
    // Fetch all emails for the user
    const emailsResponse = await net.fetch('https://api.bitbucket.org/2.0/user/emails', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!emailsResponse.ok) {
      throw new Error('Can not get bitbucket user emails');
    }

    const emailsData = (await emailsResponse.json()) as BitbucketEmailApiResponse;

    return emailsData.values.map(email => ({
      email: email.email,
      primary: email.is_primary,
      verified: email.is_confirmed,
    }));
  }

  /**
   * Fetch user info with token directly
   * Convenience method for OAuth completion
   */
  async fetchUserWithToken(token: string): Promise<BitbucketUserApiResponse> {
    const response = await net.fetch('https://api.bitbucket.org/2.0/user', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Bitbucket API error: ${response.statusText}`);
    }

    return response.json() as Promise<BitbucketUserApiResponse>;
  }

  /**
   * Initiate OAuth flow with PKCE
   * Opens the browser to Bitbucket OAuth page and manages state for security
   */
  async initiateOAuth(): Promise<OAuthInitResult> {
    try {
      const state = v4();
      const verifier = base64URLEncode(randomBytes(32));
      bitbucketStatesCache.set(state, verifier);
      const challenge = base64URLEncode(sha256(verifier));

      const bitbucketURL = new URL('https://bitbucket.org/site/oauth2/authorize');
      const { clientId } = await getBitbucketConfig();

      bitbucketURL.search = new URLSearchParams({
        client_id: clientId,
        state,
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }).toString();

      await shell.openExternal(bitbucketURL.toString());

      return {
        authUrl: bitbucketURL.toString(),
        state,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to initiate the Bitbucket OAuth flow:', error);
      throw new Error(`Failed to initiate the Bitbucket OAuth flow: ${errorMessage}`);
    }
  }

  /**
   * Complete OAuth flow with PKCE
   * Exchanges code for token and creates/updates credential in database
   */
  async completeOAuth(code: string, state: string): Promise<OAuthCompleteResult> {
    try {
      // Validate state and get verifier for PKCE
      let verifier = bitbucketStatesCache.get(state);

      if (PLAYWRIGHT) {
        verifier = 'test-verifier';
      }

      if (!verifier) {
        throw new Error('Invalid state parameter. It looks like the authorization flow was not initiated by the app.');
      }

      const { clientId } = await getBitbucketConfig();

      const bodyObj = {
        code,
        grant_type: 'authorization_code',
      };

      const bitbucketResponse = await net.fetch('https://bitbucket.org/site/oauth2/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:xxxxxx`).toString('base64')}`,
        },
        body: new URLSearchParams(bodyObj).toString(),
      });

      if (!bitbucketResponse.ok) {
        const errorBody = await bitbucketResponse.text();
        console.error('Failed to exchange code for token:', errorBody);
        throw new Error(`Failed to exchange code for token: ${bitbucketResponse.statusText}`);
      }

      const { access_token, refresh_token, expires_in } =
        (await bitbucketResponse.json()) as BitbucketOAuthTokenResponse;

      bitbucketStatesCache.delete(state);

      // Fetch user details
      const user = await this.fetchUserWithToken(access_token);
      const emails = await this.fetchUserEmailsWithToken(access_token);

      const email = emails.find(({ primary }) => primary);

      // Create or update credential in database
      const credentialData = {
        name: 'Bitbucket Credential',
        provider: 'bitbucket' as const,
        author: {
          email: email?.email || '',
          name: user.username ?? user.display_name ?? '',
          avatarUrl: user?.links?.avatar?.href || '',
        },
        credentials: {
          token: access_token,
          refreshToken: refresh_token,
          expiresAt: Date.now() + Number(expires_in) * 1000,
        },
      };

      const credential = await models.gitCredentials.create(credentialData);

      // Clear any renewal tracking since we have fresh tokens
      renewalTracker.delete(credential._id);

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete the Bitbucket OAuth flow';
      console.error('Failed to complete the Bitbucket OAuth flow:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Renew expired credential using refresh token
   */
  async renewCredential(gitCredentials: GitCredentialsV2): Promise<GitCredentialsV2> {
    if (!isGitCredentialsV2(gitCredentials) || gitCredentials.provider !== 'bitbucket') {
      throw new Error('Invalid credential type for Bitbucket provider');
    }

    if (!gitCredentials.credentials.refreshToken) {
      throw new Error('No refresh token available for renewal');
    }

    // Check renewal tracking to prevent infinite loops
    const tracker = renewalTracker.get(gitCredentials._id);
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
          renewalTracker.set(gitCredentials._id, { attempts: 1, lastAttempt: now });
        } else {
          throw new Error('Maximum token renewal attempts exceeded. Please sign in again.');
        }
      } else {
        // Increment attempts
        renewalTracker.set(gitCredentials._id, { attempts: tracker.attempts + 1, lastAttempt: now });
      }
    } else {
      // First attempt
      renewalTracker.set(gitCredentials._id, { attempts: 1, lastAttempt: now });
    }

    try {
      const { clientId } = await getBitbucketConfig();
      const url = new URL('https://bitbucket.org/site/oauth2/access_token');

      url.search = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: gitCredentials.credentials.refreshToken,
      }).toString();

      const response = await net.fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:xxxxxx`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to refresh token: ${response.statusText} - ${errorText}`);
      }

      const { access_token, refresh_token, expires_in } = (await response.json()) as BitbucketOAuthTokenResponse;

      // Update the credential in the database with new tokens
      const updatedCredential = await models.gitCredentials.update(gitCredentials, {
        credentials: {
          token: access_token,
          refreshToken: refresh_token,
          expiresAt: now + Number(expires_in) * 1000,
        },
      });

      // Reset renewal tracking on success
      renewalTracker.delete(gitCredentials._id);

      console.log('[BitbucketProvider] Successfully renewed credential');
      return updatedCredential;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to renew credential';
      console.error('[BitbucketProvider] Credential renewal failed:', error);
      throw new Error(`Bitbucket credential renewal failed: ${errorMessage}`);
    }
  }

  /**
   * Prepare auth callback for isomorphic-git
   * Converts Bitbucket OAuth token to format expected by isomorphic-git
   */
  authCallback(gitCredentials: GitCredentialsV2): GitAuth {
    if (!isGitCredentialsV2(gitCredentials) || gitCredentials.provider !== 'bitbucket') {
      throw new Error('Invalid credential type for Bitbucket provider');
    }

    // Bitbucket uses 'x-token-auth' as username and token as password
    // https://isomorphic-git.org/docs/en/authentication.html
    return {
      username: 'x-token-auth',
      password: gitCredentials.credentials.token,
    };
  }

  /**
   * Prepare auth failure callback for isomorphic-git
   * Handles token refresh on authentication failures
   */
  async authFailureCallback(gitCredentials: GitCredentialsV2): Promise<GitAuth> {
    console.log('[BitbucketProvider] Authentication failed, attempting token renewal...');

    try {
      const renewed = await this.renewCredential(gitCredentials);
      if (isGitCredentialsV2(renewed) && renewed.provider === 'bitbucket') {
        console.log('[BitbucketProvider] Token renewed successfully');
        return {
          username: 'x-token-auth',
          password: renewed.credentials.token,
        };
      }
    } catch (error) {
      console.error('[BitbucketProvider] Failed to renew credential:', error);
    }

    // Return cancel to stop the operation if renewal fails
    return { cancel: true };
  }
}
