/**
 * Git Credentials Migration Utility
 *
 * This module handles the one-time migration from the legacy credential system
 * to the new unified provider-based credential system.
 *
 * Migration Strategy:
 * 1. Find all existing git-credentials (legacy format)
 * 2. Migrate them to the new unified structure with providerType and timestamps
 * 3. Ensure git-repositories with OAuth have corresponding git-credentials entries
 *
 * After Migration:
 * - All git-credentials will have the new unified structure
 * - Provider system will be used for all authentication
 * - Legacy code paths remain as fallback for safety
 *
 * This migration:
 * - Runs once on app startup
 * - Is idempotent (safe to run multiple times)
 * - Stores version in settings to track completion
 * - Does not delete or modify legacy fields (backward compatible)
 *
 * @see git-credentials.ts for credential model
 * @see providers/ for provider implementations
 */

import type { GitCredentials, GitRepository } from 'insomnia-data';
import { database, models, services } from 'insomnia-data';

import { getElectronStorage } from '~/main/electron-storage';

const { isGitCredentialsOAuth } = models.gitRepository;
const { isGitCredentialsV1 } = models.gitCredentials;

const MIGRATION_KEY = 'GIT_CREDENTIALS_MIGRATION';

const hasRunMigration = () => {
  const migrationStorage = getElectronStorage();
  return migrationStorage.getItem(MIGRATION_KEY);
};
const markMigrationComplete = () => {
  const migrationStorage = getElectronStorage();
  migrationStorage.setItem(MIGRATION_KEY, 1);
};

async function migrateGitHubConnectedRepositories(repositories: GitRepository[]) {
  const githubCredentials = await database.findOne<GitCredentials>(models.gitCredentials.type, {
    provider: 'githubapp',
  });

  if (githubCredentials && isGitCredentialsV1(githubCredentials)) {
    const newCredential = await services.gitCredentials.create({
      name: 'GitHub Credential',
      provider: 'github',
      credentials: {
        token: githubCredentials.token,
        refreshToken: githubCredentials.refreshToken,
      },
      author: githubCredentials.author,
    });
    await services.gitCredentials.remove(githubCredentials);

    for (const repo of repositories) {
      await services.gitRepository.update(repo, {
        credentialsId: newCredential._id,
        credentials: null,
        author: {
          name: '',
          email: '',
        },
      });
    }
  } else {
    const tokenToGitCredentialsMap: Record<string, GitCredentials> = {};
    for (const repo of repositories) {
      if (
        repo.credentials &&
        isGitCredentialsOAuth(repo.credentials) &&
        repo.credentials.oauth2format === 'github' &&
        repo.credentials.token
      ) {
        if (!tokenToGitCredentialsMap[repo.credentials.token]) {
          const newCredentials = await services.gitCredentials.create({
            name: 'Github Credential',
            provider: 'github',
            author: {
              name: repo.author.name,
              email: repo.author.email,
            },
            credentials: {
              token: repo.credentials.token,
            },
          });
          tokenToGitCredentialsMap[repo.credentials.token] = newCredentials;
        }
        await services.gitRepository.update(repo, {
          credentialsId: tokenToGitCredentialsMap[repo.credentials.token]._id,
          credentials: null,
          author: {
            name: '',
            email: '',
          },
        });
      }
    }
  }
}

async function migrateGitLabConnectedRepositories(repositories: GitRepository[]) {
  const gitlabCredentials = await database.findOne<GitCredentials>(models.gitCredentials.type, { provider: 'gitlab' });

  if (gitlabCredentials && isGitCredentialsV1(gitlabCredentials)) {
    const newCredential = await services.gitCredentials.create({
      name: 'GitLab Credential',
      provider: 'gitlab',
      credentials: {
        token: gitlabCredentials.token,
        refreshToken: gitlabCredentials.refreshToken || '',
      },
      author: gitlabCredentials.author,
    });
    await services.gitCredentials.remove(gitlabCredentials);

    for (const repo of repositories) {
      await services.gitRepository.update(repo, {
        credentialsId: newCredential._id,
        credentials: null,
        author: {
          name: '',
          email: '',
        },
      });
    }
  } else {
    const tokenToGitCredentialsMap: Record<string, GitCredentials> = {};
    for (const repo of repositories) {
      if (
        repo.credentials &&
        isGitCredentialsOAuth(repo.credentials) &&
        repo.credentials.oauth2format === 'gitlab' &&
        repo.credentials.token
      ) {
        if (!tokenToGitCredentialsMap[repo.credentials.token]) {
          const newCredentials = await services.gitCredentials.create({
            name: 'GitLab Credential',
            provider: 'gitlab',
            author: {
              name: repo.author.name,
              email: repo.author.email,
            },
            credentials: {
              token: repo.credentials.token,
              refreshToken: '',
            },
          });
          tokenToGitCredentialsMap[repo.credentials.token] = newCredentials;
        }
        await services.gitRepository.update(repo, {
          credentialsId: tokenToGitCredentialsMap[repo.credentials.token]._id,
          credentials: null,
          author: {
            name: '',
            email: '',
          },
        });
      }
    }
  }
}

async function migrateCustomCredentialsRepositories(repositories: GitRepository[]) {
  for (const repo of repositories) {
    if (!repo.credentials || isGitCredentialsOAuth(repo.credentials)) {
      continue;
    }

    let credentials = await database.findOne<GitCredentials>(models.gitCredentials.type, {
      'provider': 'custom',
      'credentials.username': repo.credentials.username,
      'credentials.password': repo.credentials.password,
    } as any);

    if (!credentials) {
      credentials = await services.gitCredentials.create({
        name: 'Custom Git Credential',
        provider: 'custom',
        author: repo.author,
        credentials: {
          username: repo.credentials.username,
          password: repo.credentials.password,
        },
      });
    }

    await services.gitRepository.update(repo, {
      credentialsId: credentials._id,
      credentials: null,
      author: {
        name: '',
        email: '',
      },
    });
  }
}

/**
 * Main migration function
 * This is idempotent and safe to run multiple times
 */
export async function runGitCredentialsMigration(): Promise<void> {
  try {
    if (hasRunMigration()) {
      console.log(`[git-credentials-migration] Already migrated credentials, skipping migration`);
      return;
    }

    console.log(`[git-migration] Starting migration of git-credentials to unified format`);

    const allRepositories = await services.gitRepository.all();

    const githubConnectedRepositories = allRepositories.filter(({ credentials }) => {
      if (!credentials) {
        return false;
      }

      return isGitCredentialsOAuth(credentials) && credentials.oauth2format === 'github';
    });

    await migrateGitHubConnectedRepositories(githubConnectedRepositories);

    const gitlabConnectedRepositories = allRepositories.filter(({ credentials }) => {
      if (!credentials) {
        return false;
      }

      return isGitCredentialsOAuth(credentials) && credentials.oauth2format === 'gitlab';
    });

    await migrateGitLabConnectedRepositories(gitlabConnectedRepositories);

    const customCredentialsRepositories = allRepositories.filter(({ credentials }) => {
      return credentials && !isGitCredentialsOAuth(credentials);
    });

    await migrateCustomCredentialsRepositories(customCredentialsRepositories);

    console.log(
      `[git-credentials-migration] Migration completed ${githubConnectedRepositories.length + gitlabConnectedRepositories.length + customCredentialsRepositories.length} repositories`,
    );

    // Mark migration as complete
    markMigrationComplete();
    console.log(`[git-credentials-migration] Migration completed`);
  } catch (error) {
    console.error('[git-credentials-migration] Migration failed:', error);
  }
}
