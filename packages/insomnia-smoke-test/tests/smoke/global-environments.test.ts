import type { ElectronApplication, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

async function loadFixtureFile(fixture: string, app: ElectronApplication, page: Page) {
  const text = await loadFixture(fixture);
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByTestId('workspace-breadcrumb-level-0').click();
}

test.describe('Global Environments', () => {
  test('import and use a global environment from a collection', async ({ app, page, insomnia }) => {
    await loadFixtureFile('collection-for-global-environments.yaml', app, page);
    await loadFixtureFile('global-environment.yaml', app, page);

    await insomnia.navigationSidebar.clickRequestOrFolder('New Request');
    // check if it has error message
    await page.getByText('Body', { exact: true }).click();
    await expect
      .soft(page.getByTitle("Failed to render environment variables: _['global-base']"))
      .toHaveText("_['global-base']");
    // check if it appears as a custom message when sending the request
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('heading', { name: '2 environment variables are' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByLabel('Manage Environments').click();
    await page.getByPlaceholder('Choose a global environment').click();
    await page.getByRole('option', { name: 'global-environment' }).click();
    await page.getByText('New Environment').click();
    await page.locator('body').click();
    await page.getByRole('button', { name: 'Send' }).click();

    await page.getByRole('tab', { name: 'Console' }).click();
    await page.locator('pre').filter({ hasText: '| 4444' }).click();
    await page.locator('pre').filter({ hasText: '| 55555' }).click();
  });

  test('create a new global environment', async ({ page, insomnia }) => {
    // Create new document
    await page.getByRole('button', { name: 'Create document', exact: true }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByTestId('workspace-breadcrumb-level-0').click();
    await page.getByLabel('Create in project').click();
    await page.getByLabel('Create', { exact: true }).getByText('Environment').click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByTestId('CreateEnvironmentDropdown').click();
    await page.getByText('Private environment').click();
    await page.getByLabel('New Environment').click();
    await page.getByLabel('New Environment').getByLabel('Project Actions').click();
    await page.getByText('Duplicate').click();
    await page.getByText('New Environment (Copy)').click();
  });
});
