import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test.describe('Konnect sidebar tab', () => {
  test('shows intro card without a PAT, configure it, then sync', async ({ page, insomnia }) => {
    await page.getByTestId('sidebar-tab-konnect').click();
    await expect(page.getByText('Auto-sync your gateway service routes')).toBeVisible();

    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByLabel('Personal Access Token').fill('kpat_test');
    await page.getByRole('button', { name: 'Connect & Sync' }).click();
    await expect(page.getByText('Connected')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByRole('button', { name: 'Sync Konnect' })).toBeVisible();

    await page.getByTestId('sidebar-tab-projects').click();
    await expect(page.getByRole('button', { name: 'Create new Project' })).toBeVisible();
  });

  test('hidden when konnectSync feature flag is disabled', async ({ page, insomnia, request }) => {
    await request.post('http://127.0.0.1:4010/v1/test-utils/organizations/features', {
      data: { features: { gitSync: { enabled: true }, konnectSync: { enabled: false } } },
    });
    await page.reload();
    await expect(page.getByTestId('sidebar-tab-konnect')).toBeHidden();

    await request.post('http://127.0.0.1:4010/v1/test-utils/organizations/features', {
      data: { features: { gitSync: { enabled: true }, konnectSync: { enabled: true } } },
    });
  });
});
