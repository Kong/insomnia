import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect } from '@playwright/test';

import type { InsomniaApp } from '../../playwright/pages';
import { test } from '../../playwright/test';
import { mockOpenDialogForDirectory } from '../../playwright/utils';

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

  test('moves the repo into the picked folder and updates the displayed path', async ({ insomnia, page }) => {
    // Ensure the project dashboard URL has settled before interacting with the sidebar.
    await insomnia.projectPage.waitForProjectDashboard();

    // The picked folder IS the new location itself now — no more auto-appended
    // repo-named subfolder (see relocateGitRepoAction's doc comment). An
    // already-existing-but-empty folder (like this freshly made temp dir) is
    // still a valid target: it gets cleared and the repo moved in.
    const destDir = makeTempDir('insomnia-relocate-dest-');
    try {
      await openProjectSettingsModal(insomnia, GIT_PROJECT_NAME);

      await mockOpenDialogForDirectory(insomnia.app, destDir);
      await insomnia.projectPage.moveRepositoryToAnotherFolder();

      // Path display updates immediately from the action result (before the loader revalidates).
      await expect.soft(page.getByTitle(destDir)).toBeVisible({ timeout: 30_000 });

      // The directory must still exist on disk (rename if source existed, mkdir otherwise).
      await expect.poll(() => fs.existsSync(destDir), { timeout: 30_000 }).toBe(true);
    } finally {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
  });

  test('adopts the picked folder in place when it already contains a git repo', async ({ insomnia, page }) => {
    await insomnia.projectPage.waitForProjectDashboard();

    // Simulate reconnecting to a folder the repo was externally renamed/moved
    // to: it already has its own `.git` and content, so relocating onto it
    // must repoint `directory` only — no move/copy, nothing overwritten.
    const destDir = makeTempDir('insomnia-relocate-adopt-');
    fs.mkdirSync(path.join(destDir, '.git'));
    fs.writeFileSync(path.join(destDir, 'insomnia.wrk_marker.yaml'), 'marker: pre-existing\n');
    try {
      await openProjectSettingsModal(insomnia, GIT_PROJECT_NAME);

      await mockOpenDialogForDirectory(insomnia.app, destDir);
      await insomnia.projectPage.moveRepositoryToAnotherFolder();

      await expect.soft(page.getByTitle(destDir)).toBeVisible({ timeout: 30_000 });
      await expect.soft(page.getByText(/Repository moved to/i)).toBeVisible({ timeout: 15_000 });

      // The pre-existing marker file must be untouched — this was an adopt, not a move.
      expect.soft(fs.readFileSync(path.join(destDir, 'insomnia.wrk_marker.yaml'), 'utf8')).toBe('marker: pre-existing\n');
    } finally {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
  });

  test('shows an error when the picked folder has unrelated files in it', async ({ insomnia, page }) => {
    await insomnia.projectPage.waitForProjectDashboard();

    const destDir = makeTempDir('insomnia-relocate-collision-');
    // Unrelated content, no `.git` — neither a valid move target nor adoptable.
    fs.writeFileSync(path.join(destDir, 'unrelated.txt'), 'not a repo');
    try {
      await openProjectSettingsModal(insomnia, GIT_PROJECT_NAME);

      await mockOpenDialogForDirectory(insomnia.app, destDir);
      await insomnia.projectPage.moveRepositoryToAnotherFolder();

      // Error banner text matches relocateGitRepoAction's non-empty/non-git message.
      await expect.soft(page.getByText(/isn't a git repository/i)).toBeVisible({ timeout: 15_000 });
    } finally {
      fs.rmSync(destDir, { recursive: true, force: true });
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
