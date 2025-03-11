import path from 'node:path';

import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('can import multiple workspaces from single file', async ({ page }) => {
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-file-input"]').setInputFiles(path.join(__dirname, '../..', 'fixtures', 'multiple-workspaces.yaml'));
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await expect(page.getByLabel('Collection 1')).toBeAttached();
  await expect(page.getByLabel('Collection 2')).toBeAttached();
});
