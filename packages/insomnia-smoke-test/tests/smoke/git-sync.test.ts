import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

const mockCredentials = {
  email: 'insomnia-test@konghq.com',
  gitUsername: 'insomnia-test',
  username: 'insomnia',
  token: '12345',
  baseUrl: 'https://fakeurl.com/',
};

test.describe('Git Sync', () => {
  test.describe('with git sync feature flag disabled', () => {
    test.beforeEach(async ({ request }) => {
      // Disable git sync feature flag for organization
      await request.post('http://127.0.0.1:4010/v1/test-utils/organizations/features', {
        data: {
          features: {
            gitSync: {
              enabled: false,
            },
            konnectSync: {
              enabled: true,
            },
          },
        },
      });
    });

<<<<<<< HEAD
    test.afterEach(async ({ request }) => {
      // Re-enable git sync feature flag for organization
      await request.post('http://127.0.0.1:4010/v1/test-utils/organizations/features', {
        data: {
          features: {
            gitSync: {
              enabled: true,
            },
            konnectSync: {
              enabled: true,
            },
          },
        },
      });
    });

    test('should disable git sync usage', async ({ page }) => {
      await page.getByTestId('settings-button').click();
      await page.getByRole('tab', { name: 'Credentials' }).click();
      await page.getByRole('button', { name: 'Create Git Credential' }).click();
      await page.getByText('Access Token').click();
      await page.getByRole('textbox', { name: 'Author Email' }).fill(mockCredentials.email);
      await page.getByRole('textbox', { name: 'Author Name' }).fill(mockCredentials.gitUsername);
      await page.getByRole('textbox', { name: 'Username', exact: true }).fill(mockCredentials.username);
      await page.getByRole('textbox', { name: 'Git Access Token' }).fill(mockCredentials.token);
      await page.getByRole('textbox', { name: 'Repository base URL' }).fill(mockCredentials.baseUrl);
      await page.getByRole('button', { name: 'Save Credential' }).click();
      await page.getByRole('button', { name: 'Modal Close Button' }).click();
      await page.getByRole('button', { name: 'Create new Project' }).click();
      await page.getByLabel('Project Type Item: git').click();
      await expect.soft(page.getByLabel('Git Sync Feature Disabled Banner')).toBeVisible();

      await expect.soft(page.getByLabel('Git Setup Form')).toBeHidden();
      await expect.soft(page.getByRole('button', { name: 'Scan for files' })).toBeDisabled();
    });
  });

  test.describe('with git storage rule disabled', () => {
    test.beforeEach(async ({ request }) => {
      // Set storage rule to disable git sync
      await request.post('http://127.0.0.1:4010/v1/test-utils/organizations/storage-rule', {
        data: {
          enableCloudSync: true,
          enableGitSync: false,
          enableLocalVault: true,
          isOverridden: false,
        },
      });
    });

    test.afterEach(async ({ request }) => {
      // reset the storage rule after test
      await request.post('http://127.0.0.1:4010/v1/test-utils/organizations/storage-rule', {
        data: {
          enableCloudSync: true,
          enableGitSync: true,
          enableLocalVault: true,
          isOverridden: false,
        },
      });
    });

    test('disable git sync selection', async ({ page }) => {
      await page.getByRole('button', { name: 'Create new Project' }).click();
      const banner = page.getByLabel('Project Storage Restriction Banner');
      await expect.soft(banner).toBeVisible();
      await expect.soft(banner).not.toHaveText('Git Sync');
      await expect.soft(page.getByLabel('Project Type: git')).toBeDisabled();
    });
=======
  test.beforeEach(async ({ insomnia, request }) => {
    await request.post('http://127.0.0.1:4010/v1/test-utils/git/setup');
    await addAccessTokenGitCredential(insomnia);
    await insomnia.projectPage.createGitSyncProject();
  });

  test.afterEach(async ({ request }) => {
    await request.delete('http://127.0.0.1:4010/v1/test-utils/git/setup');
  });

  // Creates a git sync project, opens the Branches modal, creates "branch1",
  // and verifies the active branch switches to branch1.
  test('Create new branch and switch to it', async ({ page }) => {
    await page.getByTestId('git-dropdown').click();
    await page.getByRole('menuitemradio', { name: 'Branches' }).click();
    await page.getByRole('textbox', { name: 'New branch name:' }).click();
    await page.getByRole('textbox', { name: 'New branch name:' }).fill('branch1');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect.soft(page.getByText('branch1 *')).toBeVisible();
  });

  // Creates a collection to produce an unstaged change, stages it, commits with message "1",
  // then opens History and verifies the commit appears in the log.
  test('Commit and check history', async ({ page }) => {
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

  // Creates branch1, commits a new collection on it, switches back to master,
  // merges branch1 into master, and verifies the collection is visible on master.
  test('Merge branch and verify changes on the other branch has been merged into current branch', async ({ page }) => {
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
>>>>>>> 7809d458a (Update E2E test for git sync [INS-2258] (#9878))
  });

  // Creates a collection, commits it, then pushes to the remote git server.
  // Verifies the "Push completed" toast appears, confirming a successful push.
  test('Push committed changes to remote', async ({ page }) => {
    await page.getByRole('button', { name: 'New request collection' }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).press('ControlOrMeta+a');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Push Test Collection');
    await page.getByRole('textbox', { name: 'File name my_collection' }).click();
    await page.getByRole('textbox', { name: 'File name my_collection' }).press('ControlOrMeta+a');
    await page.getByRole('textbox', { name: 'File name my_collection' }).fill('push_test_collection');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await page.getByTestId('git-dropdown').click();
    await page.getByRole('menuitemradio', { name: 'Commit' }).click();
    await page.locator('button[name="Stage all changes"]').click();
    await page.getByRole('textbox', { name: 'Message' }).fill('push test commit');
    await page.getByRole('button', { name: 'Commit', exact: true }).click();

    await page.getByTestId('git-dropdown').click();
    await page.getByRole('menuitemradio', { name: 'Push' }).click();

    await expect.soft(page.getByText('Push completed')).toBeVisible();
  });

  // Creates "branch-to-delete", checks out master, then deletes the branch via the
  // two-step PromptButton (Delete → Confirm). Verifies the branch is removed from the list.
  test('Delete a branch', async ({ page }) => {
    await page.getByTestId('git-dropdown').click();
    await page.getByRole('menuitemradio', { name: 'Branches' }).click();
    await page.getByRole('textbox', { name: 'New branch name:' }).click();
    await page.getByRole('textbox', { name: 'New branch name:' }).fill('branch-to-delete');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect.soft(page.getByText('branch-to-delete *')).toBeVisible();

    await page.getByRole('row', { name: 'master' }).getByRole('button', { name: 'Checkout' }).click();
    await expect.soft(page.getByText('master *')).toBeVisible();

    await page.getByRole('row', { name: 'branch-to-delete' }).getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('row', { name: 'branch-to-delete' }).getByRole('button', { name: 'Confirm' }).click();

    await expect.soft(page.getByRole('row', { name: 'branch-to-delete' })).toBeHidden();

    await page.getByTestId('close-git-project-branches-modal').click();
    await page.getByTestId('git-project-branches-modal-overlay').waitFor({ state: 'hidden' });
    await expect.soft(page.getByTestId('git-dropdown')).toContainText('master');
  });

  // Creates a collection to produce an unstaged change, opens the staging modal,
  // clicks "Discard all changes" and confirms. Verifies the modal auto-closes,
  // indicating all changes were discarded.
  test('Discard all unstaged changes', async ({ page }) => {
    await page.getByRole('button', { name: 'New request collection' }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).press('ControlOrMeta+a');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Discard Test Collection');
    await page.getByRole('textbox', { name: 'File name my_collection' }).click();
    await page.getByRole('textbox', { name: 'File name my_collection' }).press('ControlOrMeta+a');
    await page.getByRole('textbox', { name: 'File name my_collection' }).fill('discard_test_collection');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await page.getByTestId('git-dropdown').click();
    await page.getByRole('menuitemradio', { name: 'Commit' }).click();
    await expect.soft(page.getByLabel('Unstaged changes').locator('span')).toContainText('discard_test_collection.yaml');

    await page.locator('button[name="Discard all changes"]').click();
    await page.getByTestId('discard-changes-confirm-button').click();

    // After discarding all changes the staging modal auto-closes
    await expect.soft(page.getByLabel('Unstaged changes')).toBeHidden();
  });
});
