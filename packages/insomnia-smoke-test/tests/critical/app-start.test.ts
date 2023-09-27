import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can send requests', async ({ app, page }) => {
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });
  await page.getByRole('button', { name: 'Create in project' }).click();
  const text = await loadFixture('smoke-test-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByRole('menuitemradio', { name: 'Import' }).click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByText('CollectionSmoke testsjust now').click();

  await page.getByLabel('Request Collection').getByRole('row', { name: 'send JSON request' }).click();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"id": "1"');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  await expect(responseBody).toContainText('{"id":"1"}');
  await page.getByLabel('Request Collection').getByRole('row', { name: 'send JSON request' }).click();
  await page.getByLabel('Request Collection').getByRole('row', { name: 'send JSON request' }).getByLabel('Request Actions').click();
  await page.getByRole('menuitemradio', { name: 'Generate Code' }).click();
  await page.getByText('curl --request GET \\').click();
  await page.getByRole('button', { name: 'Done' }).click();
});
