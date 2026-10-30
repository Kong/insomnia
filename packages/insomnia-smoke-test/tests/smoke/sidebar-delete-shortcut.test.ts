import { expect, type Locator, type Page } from '@playwright/test';

import type { InsomniaApp } from '../../playwright/pages';
import { test } from '../../playwright/test';

const devServerUrl = 'http://127.0.0.1:4010';
// fixtures/simple.yaml: collection "simple" > folder "test folder" > request "New Request" (plus other root requests)
const COLLECTION = 'simple';
const FOLDER = 'test folder';
const REQUEST = 'example http';

// Clicks the confirm button and verifies the confirmation modal closes
async function confirmAndExpectModalClosed(page: Page, confirm: () => Promise<void>) {
  await confirm();
  await expect.soft(page.getByRole('dialog')).toBeHidden();
}

// Focus the sidebar row itself (the shortcut ignores inner controls) and press Delete
async function pressDeleteOn(page: Page, row: Locator) {
  await row.click();
  await row.focus();
  await page.keyboard.press('Delete');
}

async function runDeleteChecks(
  page: Page,
  insomnia: InsomniaApp,
  workspaceConfirm: () => Promise<void>,
  opts: { expectConfirmHeading: string },
) {
  const sidebar = insomnia.navigationSidebar;

  // Request
  await expect.soft(sidebar.requestRow(REQUEST)).toBeVisible();
  await pressDeleteOn(page, sidebar.requestRow(REQUEST));
  await expect.soft(page.getByRole('dialog').getByText('Delete Request', { exact: true })).toBeVisible();
  await confirmAndExpectModalClosed(page, () => page.getByRole('button', { name: 'Delete', exact: true }).click());
  await expect.soft(sidebar.requestRow(REQUEST)).toBeHidden();

  // Folder
  await expect.soft(sidebar.requestRow(FOLDER)).toBeVisible();
  await pressDeleteOn(page, sidebar.requestRow(FOLDER));
  await expect.soft(page.getByRole('dialog').getByText('Delete Folder', { exact: true })).toBeVisible();
  await confirmAndExpectModalClosed(page, () => page.getByRole('button', { name: 'Delete', exact: true }).click());
  await expect.soft(sidebar.requestRow(FOLDER)).toBeHidden();

  // Workspace
  await expect.soft(sidebar.workspaceRow(COLLECTION)).toBeVisible();
  await pressDeleteOn(page, sidebar.workspaceRow(COLLECTION));
  await expect.soft(page.getByRole('dialog').getByText(opts.expectConfirmHeading, { exact: true })).toBeVisible();
  await confirmAndExpectModalClosed(page, workspaceConfirm);
  await expect.soft(sidebar.workspaceRow(COLLECTION)).toBeHidden();
}

test.describe('Sidebar Delete shortcut', () => {
  test('local project: workspace, folder and request', async ({ page, insomnia }) => {
    await insomnia.projectPage.createProject('Local Delete Project', 'local');
    await insomnia.projectPage.importFixture('simple.yaml');

    await runDeleteChecks(
      page,
      insomnia,
      // Local projects share the workspace delete modal (without the remote radio options)
      () => page.getByRole('button', { name: 'Delete Workspace' }).click(),
      { expectConfirmHeading: 'Delete API Collection' },
    );
  });

  test.describe('cloud sync project', () => {
    test.beforeAll(async () => {
      await fetch(`${devServerUrl}/__test-config/cloud-sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });
    });

    test.afterAll(async () => {
      await fetch(`${devServerUrl}/__test-config/cloud-sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });
    });

    test('workspace, folder and request', async ({ page, insomnia }) => {
      test.slow();
      await insomnia.projectPage.importFixture('simple.yaml');

      await runDeleteChecks(
        page,
        insomnia,
        // Remote projects get the dedicated modal; pick permanent deletion
        async () => {
          await page.getByRole('heading', { name: 'Delete Permanently' }).click();
          await page.getByRole('button', { name: 'Delete Workspace' }).click();
        },
        { expectConfirmHeading: 'Delete API Collection' },
      );
    });
  });

  test.describe('git sync project', () => {
    test.slow();

    test.beforeEach(async ({ insomnia, request }) => {
      await request.post(`${devServerUrl}/v1/test-utils/git/setup`);
      await insomnia.statusbar.openPreferences();
      await insomnia.preferencesPage.switchToPreferenceTab('Credentials');
      await insomnia.preferencesPage.credentialsTab.addAccessTokenGitCredential();
      await insomnia.preferencesPage.closePreferences();
      await insomnia.projectPage.createGitSyncProject('Git Delete Project');
    });

    test.afterEach(async ({ request }) => {
      await request.delete(`${devServerUrl}/v1/test-utils/git/setup`);
    });

    test('workspace, folder and request', async ({ page, insomnia }) => {
      await insomnia.projectPage.importFixture('simple.yaml');

      await runDeleteChecks(
        page,
        insomnia,
        // Git projects share the workspace delete modal (without the remote radio options)
        () => page.getByRole('button', { name: 'Delete Workspace' }).click(),
        { expectConfirmHeading: 'Delete API Collection' },
      );
    });
  });
});
