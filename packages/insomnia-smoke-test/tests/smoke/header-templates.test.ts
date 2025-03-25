import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can requests that contain templated header keys and values', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responsePaneContents = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  const collectionText = await loadFixture('header-templates.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), collectionText);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByLabel('headerTemplates').click();

  await page.getByLabel('Request Collection').getByTestId('pet2').press('Enter');

  await page.getByRole('button', { name: 'Send' }).click();

  await expect(statusTag).toContainText('200 OK');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  await expect(responsePaneContents).toContainText('{"id":"2"}');
  await page.getByRole('tab', { name: 'Console' }).click();
  await expect(responsePaneContents).toContainText('X-Foo-Bar: baz');
});
