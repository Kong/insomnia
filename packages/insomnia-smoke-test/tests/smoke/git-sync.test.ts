import { expect } from '@playwright/test';

import type { InsomniaApp } from '../../playwright/pages';
import { test } from '../../playwright/test';

test.describe('Git Sync', () => {
  test.slow();

  test('Create new branch and switch to it', async ({ insomnia, page }) => {
    await addAccessTokenGitCredential(insomnia);
    await insomnia.projectPage.createGitSyncProject();

    await page.getByTestId('git-dropdown').click();
    await page.getByRole('menuitemradio', { name: 'Branches' }).click();
    await page.getByRole('textbox', { name: 'New branch name:' }).click();
    await page.getByRole('textbox', { name: 'New branch name:' }).fill('branch1');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect.soft(page.getByText('branch1 *')).toBeVisible();
  });

  test('Commit and check history', async ({ insomnia, page }) => {
    await addAccessTokenGitCredential(insomnia);
    await insomnia.projectPage.createGitSyncProject();

    await page.getByRole('button', { name: 'New request collection' }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).press('ControlOrMeta+a');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Collection 1');
    await page.getByRole('textbox', { name: 'File name my_collection' }).click();
    await page.getByRole('textbox', { name: 'File name my_collection' }).press('ControlOrMeta+a');
    await page.getByRole('textbox', { name: 'File name my_collection' }).fill('collection_1');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByTestId('git-dropdown').click();
    await expect.soft(page.getByRole('menuitemradio', { name: 'Commit' })).toBeVisible();
    await page.getByRole('menuitemradio', { name: 'Commit' }).click();
    await expect.soft(page.getByLabel('Unstaged changes').locator('span')).toContainText('collection_1.yaml');

    await page.locator('button[name="Stage all changes"]').click();
    await page.getByRole('textbox', { name: 'Message' }).click();
    await page.getByRole('textbox', { name: 'Message' }).fill('1');
    await page.getByRole('button', { name: 'Commit', exact: true }).click();
    await page.getByTestId('git-dropdown').click();
    await page.getByText('History').click();
    await expect.soft(page.getByLabel('1', { exact: true }).getByRole('rowheader')).toContainText('1');
  });

  test('Merge branch and verify changes on the other branch has been merged into current branch', async ({
    insomnia,
    page,
  }) => {
    await addAccessTokenGitCredential(insomnia);
    await insomnia.projectPage.createGitSyncProject();

    await page.getByTestId('git-dropdown').click();
    await page.getByRole('menuitemradio', { name: 'Branches' }).click();
    await page.getByRole('textbox', { name: 'New branch name:' }).click();
    await page.getByRole('textbox', { name: 'New branch name:' }).fill('branch1');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect.soft(page.getByText('branch1 *')).toBeVisible();
    await page.getByTestId('close-git-project-branches-modal').click();
    await page.getByTestId('git-project-branches-modal-overlay').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'New request collection' }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).press('ControlOrMeta+a');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('collection 1');
    await page.getByRole('textbox', { name: 'File name my_collection' }).click();
    await page.getByRole('textbox', { name: 'File name my_collection' }).press('ControlOrMeta+a');
    await page.getByRole('textbox', { name: 'File name my_collection' }).fill('collection_1');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByTestId('project').click();
    await page.getByTestId('git-dropdown').click();
    await page.getByRole('menuitemradio', { name: 'Commit' }).click();
    await page.locator('button[name="Stage all changes"]').click();
    await page.getByRole('textbox', { name: 'Message' }).click();
    await page.getByRole('textbox', { name: 'Message' }).fill('commit 1');
    await page.getByRole('button', { name: 'Commit', exact: true }).click();
    await page.getByTestId('git-dropdown').click();
    await page.getByRole('menuitemradio', { name: 'master' }).click();
    await page.locator('html').click();
    await page.getByTestId('git-dropdown').click();
    await page.getByRole('menuitemradio', { name: 'Branches' }).click();
    await page.getByLabel('branch1').getByRole('button', { name: 'Merge' }).click();
    await page.getByRole('button', { name: ' Confirm' }).click();
    await page.getByTestId('close-git-project-branches-modal').click();
    await page.getByTestId('git-project-branches-modal-overlay').waitFor({ state: 'hidden' });
    await expect.soft(page.getByText('collection 1')).toBeVisible();
  });
});

async function addAccessTokenGitCredential(insomnia: InsomniaApp) {
  await insomnia.statusbar.openPreferences();
  await insomnia.preferencesPage.switchToPreferenceTab('Credentials');
  await insomnia.preferencesPage.credentialsTab.addAccessTokenGitCredential();
  await expect.soft(insomnia.page.getByRole('row', { name: 'Custom Git Credential' })).toBeVisible();
  await insomnia.preferencesPage.closePreferences();
}
