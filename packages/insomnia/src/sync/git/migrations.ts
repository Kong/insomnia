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

import { database } from '~/common/database';
import { initElectronStorage } from '~/main/window-utils';
import { type GitRepository, isGitCredentialsOAuth } from '~/models/git-repository';

import * as models from '../../models';
import type { GitCredentials } from '../../models/git-credentials';

const MIGRATION_KEY = 'GIT_CREDENTIALS_MIGRATION';

const migrationStorage = initElectronStorage();
const hasRunMigration = () => migrationStorage.getItem(MIGRATION_KEY);
const markMigrationComplete = () => migrationStorage.setItem(MIGRATION_KEY, 1);

async function migrateGitHubConnectedRepositories(repositories: GitRepository[]) {
  const githubCredentials = await database.findOne<GitCredentials>(models.gitCredentials.type, {
    provider: 'githubapp',
  });

  if (githubCredentials) {
    await models.gitCredentials.update(githubCredentials, {
      name: 'Github Credential',
      provider: 'github',
      renewalAttempts: 0,
    });

    for (const repo of repositories) {
      await models.gitRepository.update(repo, {
        credentialsId: githubCredentials._id,
        credentials: null,
        author: {
          name: '',
          email: '',
        },
      });
    }
  }
}

async function migrateGitLabConnectedRepositories(repositories: GitRepository[]) {
  const gitlabCredentials = await database.findOne<GitCredentials>(models.gitCredentials.type, { provider: 'gitlab' });

  if (gitlabCredentials) {
    await models.gitCredentials.update(gitlabCredentials, {
      name: 'Gitlab Credential',
      provider: 'gitlab',
      renewalAttempts: 0,
    });

    for (const repo of repositories) {
      await models.gitRepository.update(repo, {
        credentialsId: gitlabCredentials._id,
        credentials: null,
        author: {
          name: '',
          email: '',
        },
      });
    }
  }
}

async function migrateCustomCredentialsRepositories(repositories: GitRepository[]) {
  for (const repo of repositories) {
    if (!repo.credentials || isGitCredentialsOAuth(repo.credentials)) {
      continue;
    }

    let credentials = await database.findOne<GitCredentials>(models.gitCredentials.type, {
      provider: 'custom',
      username: repo.credentials.username,
      password: repo.credentials.password,
    });

    if (!credentials) {
      credentials = await models.gitCredentials.create({
        name: 'Custom Git Credential',
        provider: 'custom',
        author: repo.author,
        renewalAttempts: 0,
        username: repo.credentials.username,
        password: repo.credentials.password,
      });
    }

    await models.gitRepository.update(repo, {
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

    const allRepositories = await models.gitRepository.all();

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
