import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can chain multiple requests', async ({ app, page, insomnia }) => {
  const text = await loadFixture('chained-responses.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await insomnia.navigationSidebar.clickRequestOrFolder('third');
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

  // third request will call second request which will call first request
  // Wait for the full chain to complete — chained response tags re-send upstream requests
  await expect.soft(page.getByRole('button', { name: 'Cancel Request' })).toBeHidden({ timeout: 60_000 });
  await expect.soft(page.getByTestId('response-pane')).toContainText('first and second and third');
});
