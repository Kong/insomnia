import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can use node-libcurl, httpsnippet, hidden browser window', async ({ app, page }) => {
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  const text = await loadFixture('smoke-test-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByLabel('Smoke tests').click();

  await page.getByLabel('Request Collection').getByTestId('send JSON request').press('Enter');
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"id": "1"');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  await expect(responseBody).toContainText('{"id":"1"}');
  await page.getByLabel('Request Collection').getByTestId('send JSON request').press('Enter');
  await page.getByLabel('Request Collection').getByTestId('send JSON request').getByLabel('Request Actions').click();
  await page.getByRole('menuitemradio', { name: 'Generate Code' }).click();
  await page.getByText('curl --request GET \\').click();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByLabel('Request Collection').getByTestId('sends request with pre-request script').press('Enter');
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect(statusTag).toContainText('200 OK');
  await page.getByRole('tab', { name: 'Console' }).click();
});

test('can use external modules in scripts ', async ({ app, page }) => {
  const text = await loadFixture('pre-request-collection.yaml');

  // import collection
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  // select request
  await page.getByLabel('Pre-request Scripts').click();
  await page.getByLabel('Request Collection').getByTestId('use external modules').press('Enter');

  // send
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

  // verify
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  await expect(statusTag).toContainText('200 OK');
});
