import { expect } from '@playwright/test';

import { InsomniaApp } from '../../playwright/pages';
import { test } from '../../playwright/test';

test('Can import multiple workspaces from single file', async ({ app, page }) => {
  const insomnia = new InsomniaApp(page, app);
  await insomnia.projectPage.importFixture('import/multiple-workspaces.yaml');

  // Have two collections in current project
  await expect.soft(insomnia.projectPage.workspaceList.workspaceLocator('Collection 1')).toBeVisible();
  await expect.soft(insomnia.projectPage.workspaceList.workspaceLocator('Collection 2')).toBeVisible();

  await insomnia.projectPage.workspaceList.openWorkspace('Collection 2');
  await expect.soft(page.getByTestId('workspace-context-dropdown').getByText(`Collection 2`)).toBeVisible();
});

test('Can generate content-type header from imported postman file', async ({ app, page }) => {
  const insomnia = new InsomniaApp(page, app);
  await insomnia.projectPage.importFixture('import/import-content-type-from-postman.json');

  // Navigate into the imported request and check content-type header
  await page.getByTestId('New Request').click();
  await page.locator('[data-key="headers"]').click();
  await expect.soft(page.getByText('application/x-www-form-urlencoded')).toBeAttached();
});
