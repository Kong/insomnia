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
          },
        },
      });
    });

    test.afterEach(async ({ request }) => {
      // Re-enable git sync feature flag for organization
      await request.post('http://127.0.0.1:4010/v1/test-utils/organizations/features', {
        data: {
          features: {
            gitSync: {
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
  });
});
