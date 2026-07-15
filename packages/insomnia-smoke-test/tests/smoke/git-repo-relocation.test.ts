import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect } from '@playwright/test';

import type { InsomniaApp } from '../../playwright/pages';
import { test } from '../../playwright/test';
import { mockOpenDialogForDirectory } from '../../playwright/utils';

// deriveRepoName('http://localhost:4010/git/git-server.git') === 'git-server'
const DERIVED_REPO_NAME = 'git-server';
const GIT_PROJECT_NAME = 'Relocation Test Project';

const makeTempDir = (prefix: string) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

test.describe('Git repository relocation', () => {
  test.slow();

  test.beforeEach(async ({ insomnia, request }) => {
    await request.post('http://127.0.0.1:4010/v1/test-utils/git/setup');
    await addAccessTokenGitCredential(insomnia);
    await insomnia.projectPage.createGitSyncProject(GIT_PROJECT_NAME);
  });

  test.afterEach(async ({ request }) => {
    await request.delete('http://127.0.0.1:4010/v1/test-utils/git/setup');
  });

  test('moves the repo to a new parent folder and updates the displayed path', async ({ insomnia, page }) => {
    // Ensure the project dashboard URL has settled before interacting with the sidebar.
    await insomnia.projectPage.waitForProjectDashboard();

    const destParent = makeTempDir('insomnia-relocate-dest-');
    const expectedPath = path.join(destParent, DERIVED_REPO_NAME);
    try {
      await openProjectSettingsModal(insomnia, GIT_PROJECT_NAME);

      await mockOpenDialogForDirectory(insomnia.app, destParent);
      await page.getByRole('button', { name: 'Move repository to another folder' }).click();

      // Path display updates immediately from the action result (before the loader revalidates).
      await expect.soft(page.getByTitle(expectedPath)).toBeVisible({ timeout: 30_000 });

      // The new directory must exist on disk (rename if source existed, mkdir otherwise).
      await expect.poll(() => fs.existsSync(expectedPath), { timeout: 30_000 }).toBe(true);
    } finally {
      fs.rmSync(destParent, { recursive: true, force: true });
    }
  });

  test('shows an error when the destination folder already exists (collision guard)', async ({ insomnia, page }) => {
    await insomnia.projectPage.waitForProjectDashboard();

    const destParent = makeTempDir('insomnia-relocate-collision-');
    // Pre-create the derived subdirectory so the collision guard fires.
    fs.mkdirSync(path.join(destParent, DERIVED_REPO_NAME));
    try {
      await openProjectSettingsModal(insomnia, GIT_PROJECT_NAME);

      await mockOpenDialogForDirectory(insomnia.app, destParent);
      await page.getByRole('button', { name: 'Move repository to another folder' }).click();

      // Error banner text matches relocateGitRepoAction's collision message.
      await expect.soft(page.getByText(/That folder already exists/i)).toBeVisible({ timeout: 15_000 });
    } finally {
      fs.rmSync(destParent, { recursive: true, force: true });
    }
  });
});

async function openProjectSettingsModal(insomnia: InsomniaApp, projectName: string): Promise<void> {
  await insomnia.navigationSidebar.selectProjectDropdownOption({
    actionName: 'Settings',
    projectName,
  });
  await insomnia.page.getByRole('dialog', { name: 'Create or update dialog' }).waitFor({ state: 'visible' });
}

async function addAccessTokenGitCredential(insomnia: InsomniaApp): Promise<void> {
  await insomnia.statusbar.openPreferences();
  await insomnia.preferencesPage.switchToPreferenceTab('Credentials');
  await insomnia.preferencesPage.credentialsTab.addAccessTokenGitCredential();
  await expect.soft(insomnia.page.getByRole('row', { name: 'Custom Git Credential' })).toBeVisible();
  await insomnia.preferencesPage.closePreferences();
}
