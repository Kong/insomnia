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
  test('disable git sync when feature flag is closed', async ({ page, request }) => {
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

    await page.getByTestId('settings-button').click();
    await page.getByRole('tab', { name: 'Credentials' }).click();
    await page.getByRole('button', { name: 'Create Git Credential' }).click();
    await page.getByText('Access Token').click();
    await page.getByRole('textbox', { name: 'Your Email' }).click();
    await page.getByRole('textbox', { name: 'Your Email' }).fill(mockCredentials.email);
    await page.getByRole('textbox', { name: 'Your Git Username' }).fill(mockCredentials.gitUsername);
    await page.getByRole('textbox', { name: 'Username', exact: true }).click();
    await page.getByRole('textbox', { name: 'Username', exact: true }).fill(mockCredentials.username);
    await page.getByRole('textbox', { name: 'Git Access Token' }).click();
    await page.getByRole('textbox', { name: 'Git Access Token' }).fill(mockCredentials.token);
    await page.getByRole('textbox', { name: 'Repository base URL' }).click();
    await page.getByRole('textbox', { name: 'Repository base URL' }).fill(mockCredentials.baseUrl);
    await page.getByRole('button', { name: 'Save Credential' }).click();
    await page.getByRole('button', { name: 'Modal Close Button' }).click();
    await page.getByRole('button', { name: 'Create new Project' }).click();
    await page.getByLabel('Project Type Item: git').click();
    await expect.soft(page.getByLabel('Git Sync Feature Disabled Banner')).toBeVisible();

    await expect.soft(page.getByLabel('Git Setup Form')).toBeHidden();
    await expect.soft(page.getByRole('button', { name: 'Scan for files' })).toBeDisabled();
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
});
