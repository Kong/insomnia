import fs from 'node:fs';
import path from 'node:path';

import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

// Seeds a data directory with a single connected Git project whose GitRepository
// has no `repoMigrationVersion` stamp, so `getInitialEntry` treats it as having a
// pending Git filesystem migration and routes to `/git-migration` on launch.
//
// The repo has no on-disk `git/` or `other/` directories, so the structure
// migration is a no-op that completes successfully without needing real git files.
const seedPendingGitMigration = async (dataPath: string) => {
  const now = Date.now();
  // Legacy ('git_xxx') format on the project so getInitialEntry's `_id $in` query
  // matches the GitRepository._id directly (this is the pre-migration layout).
  const gitRepositoryId = 'git_smoketestpending';

  const project = {
    _id: 'proj_smoketestgit',
    type: 'Project',
    parentId: null,
    modified: now,
    created: now,
    name: 'Git Migration Smoke Project',
    remoteId: null,
    gitRepositoryId,
  };

  const gitRepository = {
    _id: gitRepositoryId,
    type: 'GitRepository',
    parentId: null,
    modified: now,
    created: now,
    needsFullClone: false,
    uri: 'https://github.com/example/insomnia-git-example.git',
    credentials: null,
    author: { name: '', email: '' },
    uriNeedsMigration: false,
    // Intentionally no `repoMigrationVersion` → treated as a pending migration.
  };

  await fs.promises.mkdir(dataPath, { recursive: true });
  await fs.promises.writeFile(path.join(dataPath, 'insomnia.Project.db'), JSON.stringify(project) + '\n', 'utf8');
  await fs.promises.writeFile(
    path.join(dataPath, 'insomnia.GitRepository.db'),
    JSON.stringify(gitRepository) + '\n',
    'utf8',
  );
};

const testWithPendingGitMigration = test.extend({
  dataPath: async ({ dataPath }, use) => {
    await seedPendingGitMigration(dataPath);
    await use(dataPath);
  },
  userConfig: async ({ userConfig }, use) => {
    await use({
      ...userConfig,
      // Do not pre-mark onboarding as seen — we want the v13 onboarding to appear
      // immediately after the migration completes.
      skipOnboarding: false,
    });
  },
});

testWithPendingGitMigration(
  'shows Git migration first, then the v13 onboarding immediately after it completes',
  async ({ page }) => {
    // Migration may take a moment; avoid timing out before the min-display window elapses.
    test.slow();

    // 1. The Git migration route is shown first (before the v13 onboarding).
    await expect.soft(page.getByRole('heading', { name: "What's new in v12.6.0" })).toBeVisible();
    // The v13 onboarding welcome must not be visible yet.
    await expect.soft(page.getByRole('heading', { name: /Welcome to Insomnia 13/ })).toBeHidden();

    await page.getByRole('button', { name: 'Continue' }).click();

    // 2. Run the filesystem migration.
    await expect.soft(page.getByRole('heading', { name: 'Required file system update' })).toBeVisible();
    await page.getByRole('button', { name: 'Update Now' }).click();

    // 3. Migration completes successfully.
    await expect.soft(page.getByRole('heading', { name: 'Update Successful' })).toBeVisible({ timeout: 30_000 });

    // 4. Opening Insomnia from the completed migration lands on the v13 onboarding.
    await page.getByRole('link', { name: 'Open Insomnia' }).click();
    await expect.soft(page.getByRole('heading', { name: /Welcome to Insomnia 13/ })).toBeVisible();
  },
);
