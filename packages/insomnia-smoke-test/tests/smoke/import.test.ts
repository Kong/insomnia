import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can import multiple workspaces from single file', async ({ app, page }) => {
  const text = await loadFixture('multiple-workspaces.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  // Have two collections in current project
  await expect(page.getByLabel('Collection 1')).toBeAttached();
  await expect(page.getByLabel('Collection 2')).toBeAttached();
});
