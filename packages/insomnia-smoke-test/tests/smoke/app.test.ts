import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can send requests', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  await page.getByTestId('project').click();
  await page.getByRole('button', { name: 'Create' }).click();

  const text = await loadFixture('smoke-test-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByRole('menuitem', { name: 'Clipboard' }).click();
  await page.click('text=CollectionSmoke testsjust now');

  await page.getByRole('button', { name: 'send JSON request' }).click();
  await page.click('text=http://127.0.0.1:4010/pets/1Send >> button');
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"id": "1"');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  await expect(responseBody).toContainText('{"id":"1"}');

  await page.getByRole('button', { name: 'sends dummy.csv request and shows rich response' }).click();
  await page.click('text=http://127.0.0.1:4010/file/dummy.csvSend >> button');
  await expect(statusTag).toContainText('200 OK');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  await expect(responseBody).toContainText('a,b,c');

  await page.getByRole('button', { name: 'sends dummy.xml request and shows raw response' }).click();
  await page.click('text=http://127.0.0.1:4010/file/dummy.xmlSend >> button');
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('xml version="1.0"');
  await expect(responseBody).toContainText('<LoginResult>');

  await page.getByRole('button', { name: 'sends dummy.pdf request and shows rich response' }).click();
  await page.click('text=http://127.0.0.1:4010/file/dummy.pdfSend >> button');
  await expect(statusTag).toContainText('200 OK');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  await expect(responseBody).toContainText('PDF-1.4');

  await page.getByRole('button', { name: 'sends request with basic authentication' }).click();
  await page.click('text=http://127.0.0.1:4010/auth/basicSend >> button');
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('basic auth received');

  await page.getByRole('button', { name: 'sends request with cookie and get cookie in response' }).click();
  await page.click('text=http://127.0.0.1:4010/cookiesSend >> button');
  await expect(statusTag).toContainText('200 OK');
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await expect(responseBody).toContainText('Set-Cookie: insomnia-test-cookie=value123');
});

// This feature is unsafe to place beside other tests, cancelling a request can cause network code to block
// related to https://linear.app/insomnia/issue/INS-973
test('can cancel requests', async ({ app, page }) => {
  await page.getByTestId('project').click();
  await page.getByRole('button', { name: 'Create' }).click();

  const text = await loadFixture('smoke-test-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByRole('menuitem', { name: 'Clipboard' }).click();
  await page.click('text=CollectionSmoke testsjust now');

  await page.getByRole('button', { name: 'delayed request' }).click();
  await page.click('text=http://127.0.0.1:4010/delay/seconds/20Send >> button');

  await page.getByRole('button', { name: 'Cancel Request' }).click();
  await page.click('text=Request was cancelled');
});

test('url field is focused for first time users', async ({ page }) => {
  const urlInput = ':nth-match(textarea, 2)';
  const locator = page.locator(urlInput);
  await expect(locator).toBeFocused();
});
