import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('Can import multiple workspaces from single file', async ({ app, page }) => {
  const text = await loadFixture('import/multiple-workspaces.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  // Have two collections in current project
  await expect.soft(page.getByLabel('Collection 1')).toBeAttached();
  await expect.soft(page.getByLabel('Collection 2')).toBeAttached();
});

test('Can generate content-type header from imported postman file', async ({ app, page }) => {
  const text = await loadFixture('import/import-content-type-from-postman.json');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  // Have generated content-type of application/x-www-form-urlencoded for the request
  await page.getByRole('link', { name: 'New Collection' }).click();
  await page.getByTestId('New Request').click();
  await page.locator('[data-key="headers"]').click();
  await expect.soft(page.getByText('application/x-www-form-urlencoded')).toBeAttached();
});
