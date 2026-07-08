import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect } from '@playwright/test';

import type { InsomniaApp } from '../../playwright/pages';
import { test } from '../../playwright/test';

// Verifies repositories can live in user-chosen folders on disk:
//  - opening an existing/plain folder as a Git project (runs `git init` if needed)
//  - cloning into a user-chosen destination folder

const makeTempDir = (prefix: string) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

test.describe('Git repositories in user-chosen folders', () => {
  test.slow();

  test('opens a plain local folder as a Git project and initializes git', async ({ insomnia, page }) => {
    const folder = makeTempDir('insomnia-open-folder-');
    try {
      // The folder is not a git repo yet — no .git present.
      expect.soft(fs.existsSync(path.join(folder, '.git'))).toBe(false);

      await insomnia.projectPage.openGitProjectFromFolder('Opened Folder Project', folder);

      // `git init` must have run inside the chosen folder.
      await expect.poll(() => fs.existsSync(path.join(folder, '.git')), { timeout: 30_000 }).toBe(true);

      // The project landed — no error banner.
      await expect.soft(page.getByText('Opened Folder Project')).toBeVisible();
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  test('blocks opening the same folder twice (collision guard)', async ({ insomnia, page }) => {
    const folder = makeTempDir('insomnia-open-collision-');
    try {
      await insomnia.projectPage.openGitProjectFromFolder('First Adoption', folder);
      await expect.poll(() => fs.existsSync(path.join(folder, '.git')), { timeout: 30_000 }).toBe(true);

      // Back to the project dashboard, then try to adopt the same folder again.
      await insomnia.projectPage.chooseGitProjectFolderForOpen('Second Adoption', folder);

      // The UI blocks before submit and surfaces the already-connected folder.
      await expect.soft(page.getByText(/already connected to this folder/i)).toBeVisible();
      await expect.soft(page.getByRole('button', { name: 'Open', exact: true })).toBeDisabled();
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});

test.describe('Git clone into a user-chosen folder', () => {
  test.slow();

  test.beforeEach(async ({ insomnia, request }) => {
    await request.post('http://127.0.0.1:4010/v1/test-utils/git/setup');
    await addAccessTokenGitCredential(insomnia);
  });

  test.afterEach(async ({ request }) => {
    await request.delete('http://127.0.0.1:4010/v1/test-utils/git/setup');
  });

  test('clones into <chosen-parent>/<repo-name>', async ({ insomnia }) => {
    const parent = makeTempDir('insomnia-clone-dest-');
    try {
      await insomnia.projectPage.cloneGitProjectIntoFolder('Cloned Into Folder', parent);

      // The repo URL is "git-server.git" → derived repo name "git-server".
      await expect.poll(() => fs.existsSync(path.join(parent, 'git-server', '.git')), { timeout: 60_000 }).toBe(true);
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });
});

async function addAccessTokenGitCredential(insomnia: InsomniaApp) {
  await insomnia.statusbar.openPreferences();
  await insomnia.preferencesPage.switchToPreferenceTab('Credentials');
  await insomnia.preferencesPage.credentialsTab.addAccessTokenGitCredential();
  await expect.soft(insomnia.page.getByRole('row', { name: 'Custom Git Credential' })).toBeVisible();
  await insomnia.preferencesPage.closePreferences();
}
