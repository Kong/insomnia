import { expect } from '@playwright/test';

import { InsomniaApp } from '../../playwright/pages';
import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can use bundled plugins, node-libcurl, httpsnippet, hidden browser window', async ({ app, page }) => {
  const insomnia = new InsomniaApp(page, app);
  await insomnia.statusbar.openPreferences();
  await page.getByRole('tab', { name: 'Credentials' }).click();
  // Check that bundled plugins are available in the Cloud Credentials tab
  await expect.soft(page.getByRole('button', { name: 'Create Cloud Credential' })).toBeVisible();
  await page.locator('.app').press('Escape');

  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  const text = await loadFixture('smoke-test-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByRole('button', { name: 'Import' }).click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await insomnia.navigationSidebar.clickRequestOrFolder('send JSON request');
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"id": "1"');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  await expect.soft(responseBody).toContainText('{"id":"1"}');
  await insomnia.navigationSidebar.openRequestActionsDropdown('send JSON request');
  await page.getByRole('menuitemradio', { name: 'Generate Code' }).click();
  await page.getByText('curl --request GET \\').click();
  await page.getByRole('button', { name: 'Done' }).click();

  await insomnia.navigationSidebar.clickRequestOrFolder('sends request with pre-request script');
  await expect
    .soft(page.getByTestId('request-pane').getByTestId('OneLineEditor').getByText(`http://127.0.0.1:4010/echo`))
    .toBeVisible();

  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await page.getByRole('tab', { name: 'Console' }).click();
});

test('can use external modules in scripts', async ({ app, page, insomnia }) => {
  const text = await loadFixture('pre-request-collection.yaml');

  // import collection
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByRole('button', { name: 'Import' }).click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  // select request
  await insomnia.navigationSidebar.clickRequestOrFolder('use external modules');

  // send
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

  // verify
  await expect.soft(page.getByTestId('response-status-tag')).toContainText('200 OK');
});
