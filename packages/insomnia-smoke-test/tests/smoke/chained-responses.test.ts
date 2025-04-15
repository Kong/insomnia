import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can chain multiple requests', async ({ app, page }) => {
  const text = await loadFixture('chained-responses.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByLabel('test chains').click();

  await page.getByLabel('Request Collection').getByTestId('third').press('Enter');
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

  // third request will call second request which will call first request
  await expect.soft(page.getByTestId('response-pane')).toContainText('first and second and third');
});
