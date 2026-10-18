import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('only manual cookies are template-rendered when sending a request', async ({ app, page, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responsePaneContents = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  const collectionText = await loadFixture('cookie-source-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), collectionText);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await insomnia.navigationSidebar.clickRequestOrFolder('echo-cookies');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect.soft(statusTag).toContainText('200 OK');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();

  // The /cookies endpoint echoes back the Cookie header it received.
  // manual and untagged (grandfathered to manual) cookies are rendered; response cookies stay literal.
  await expect.soft(responsePaneContents).toContainText('cookieManual=rendered');
  await expect.soft(responsePaneContents).toContainText('cookieUntagged=rendered');
  await expect.soft(responsePaneContents).toContainText("cookieResponse={{ 'rendered' }}");
});
