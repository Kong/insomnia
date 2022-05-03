import { expect } from '@playwright/test';

import { loadFixture } from '../playwright/paths';
import { test } from '../playwright/test';

test('can send requests', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const sendButton = page.locator('[data-testid="request-pane"] button:has-text("Send")');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  await page.click('[data-testid="project"]');
  await page.click('text=Create');

  const text = await loadFixture('smoke-test-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.click('button:has-text("Clipboard")');

  await page.click('_react=WorkspaceCard[workspace.name = "Smoke tests"]');

  await page.click('_react=SidebarRequestRow[request.name = "send JSON request"]');
  await sendButton.click();
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"id": "1"');
  await page.click('button:has-text("Preview")');
  await page.click('button:has-text("Raw Data")');
  await expect(responseBody).toContainText('{"id":"1"}');

  await page.click('_react=SidebarRequestRow[request.name = "sends dummy.csv request and shows rich response"]');
  await sendButton.click();
  await expect(statusTag).toContainText('200 OK');
  await page.click('button:has-text("Preview")');
  await page.click('button:has-text("Raw Data")');
  await expect(responseBody).toContainText('a,b,c');

  await page.click('_react=SidebarRequestRow[request.name = "sends dummy.xml request and shows raw response"]');
  await sendButton.click();
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('xml version="1.0"');
  await expect(responseBody).toContainText('<LoginResult>');

  await page.click('_react=SidebarRequestRow[request.name = "sends dummy.pdf request and shows rich response"]');
  await sendButton.click();
  await expect(statusTag).toContainText('200 OK');
  await page.click('button:has-text("Preview")');
  await page.click('button:has-text("Raw Data")');
  await expect(responseBody).toContainText('PDF-1.4');

  await page.click('_react=SidebarRequestRow[request.name = "sends request with basic authentication"]');
  await sendButton.click();
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('basic auth received');

  await page.click('_react=SidebarRequestRow[request.name = "sends request with cookie and get cookie in response"]');
  await sendButton.click();
  await expect(statusTag).toContainText('200 OK');
  await page.click('[data-testid="response-pane"] >> [role="tab"]:has-text("Timeline")');
  await expect(responseBody).toContainText('Set-Cookie: insomnia-test-cookie=value123');
});

// This feature is unsafe to place beside other tests, cancelling a request can cause network code to block
// related to https://linear.app/insomnia/issue/INS-973
test('can cancel requests', async ({ app, page }) => {
  const sendButton = page.locator('[data-testid="request-pane"] button:has-text("Send")');
  await page.click('[data-testid="project"]');
  await page.click('text=Create');

  const text = await loadFixture('smoke-test-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.click('button:has-text("Clipboard")');
  await page.click('_react=WorkspaceCard[workspace.name = "Smoke tests"]');

  await page.click('_react=SidebarRequestRow[request.name = "delayed request"]');
  await sendButton.click();

  await page.click('[data-testid="response-pane"] button:has-text("Cancel Request")');
  await page.click('text=Request was cancelled');
});

test('url field is focused for first time users', async ({ page }) => {
  const urlInput = ':nth-match(textarea, 2)';
  const locator = page.locator(urlInput);
  await expect(locator).toBeFocused();
});
