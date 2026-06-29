import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test.describe('Konnect sidebar tab', () => {
  test('shows intro card without a PAT, configure it, then sync', async ({ page, insomnia }) => {
    await page.getByTestId('sidebar-tab-konnect').click();
    await expect.soft(page.getByText('Auto-sync your gateway service routes')).toBeVisible();

    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByLabel('Personal Access Token').fill('kpat_test');
    await page.getByRole('button', { name: 'Connect & Sync' }).click();
    await expect.soft(page.getByRole('heading', { name: 'Kong Konnect settings' })).toBeHidden();

    await expect.soft(page.getByRole('button', { name: 'Sync Konnect' })).toBeVisible();

    await page.getByTestId('sidebar-tab-projects').click();
    await expect.soft(page.getByRole('button', { name: 'Create new Project' })).toBeVisible();
  });

  test.describe('with konnectSync feature flag disabled', () => {
    test.beforeEach(async ({ request }) => {
      await request.post('http://127.0.0.1:4010/v1/test-utils/organizations/features', {
        data: { features: { gitSync: { enabled: true }, konnectSync: { enabled: false } } },
      });
    });

    test.afterEach(async ({ request }) => {
      await request.post('http://127.0.0.1:4010/v1/test-utils/organizations/features', {
        data: { features: { gitSync: { enabled: true }, konnectSync: { enabled: true } } },
      });
    });

    test('hides the Konnect tab', async ({ page }) => {
      await page.reload({ waitUntil: 'networkidle' });
      await expect.soft(page.getByTestId('sidebar-tab-konnect')).toBeHidden();
    });
  });
});
