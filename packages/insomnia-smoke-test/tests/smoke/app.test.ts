import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can send requests', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  await page.getByRole('button', { name: 'Create' }).click();

  const text = await loadFixture('smoke-test-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByRole('menuitem', { name: 'Import' }).click();
  await page.getByText('Clipboard').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByText('CollectionSmoke testsjust now').click();

  // re enable test when sidebar selector is fixed
  // await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  // await page.getByRole('menuitem', { name: 'Http Request' }).click();
  // const curl = 'curl --request POST --url http://mockbin.org/status/200';
  // await app.evaluate(async ({ clipboard }, curl) => clipboard.writeText(curl), curl);
  // await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  // await page.getByRole('menuitem', { name: 'From Curl' }).click();

  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect(statusTag).toContainText('200 OK');

  await page.getByRole('button', { name: 'send JSON request' }).click();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"id": "1"');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  await expect(responseBody).toContainText('{"id":"1"}');

  await page.getByRole('button', { name: 'connects to event stream and shows ping response' }).click();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Connect' }).click();
  await expect(statusTag).toContainText('200 OK');
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await expect(responseBody).toContainText('Connected to 127.0.0.1');
  await page.getByTestId('request-pane').getByRole('button', { name: 'Disconnect' }).click();

  await page.getByRole('button', { name: 'sends dummy.csv request and shows rich response' }).click();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect(statusTag).toContainText('200 OK');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  await expect(responseBody).toContainText('a,b,c');

  await page.getByRole('button', { name: 'sends dummy.xml request and shows raw response' }).click();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('xml version="1.0"');
  await expect(responseBody).toContainText('<LoginResult>');

  await page.getByRole('button', { name: 'sends dummy.pdf request and shows rich response' }).click();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect(statusTag).toContainText('200 OK');
  // TODO(filipe): re-add a check for the preview that is less flaky
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await page.locator('pre').filter({ hasText: '< Content-Type: application/pdf' }).click();

  await page.getByRole('button', { name: 'sends request with basic authentication' }).click();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('basic auth received');

  await page.getByRole('button', { name: 'sends request with cookie and get cookie in response' }).click();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect(statusTag).toContainText('200 OK');
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await expect(responseBody).toContainText('Set-Cookie: insomnia-test-cookie=value123');
});

// This feature is unsafe to place beside other tests, cancelling a request can cause network code to block
// related to https://linear.app/insomnia/issue/INS-973
test('can cancel requests', async ({ app, page }) => {
  await page.getByRole('button', { name: 'Create' }).click();

  const text = await loadFixture('smoke-test-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByRole('menuitem', { name: 'Import' }).click();
  await page.getByText('Clipboard').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByText('CollectionSmoke testsjust now').click();

  await page.getByRole('button', { name: 'delayed request' }).click();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

  await page.getByRole('button', { name: 'Cancel Request' }).click();
  await page.click('text=Request was cancelled');
});
