import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('gRPC interactions', () => {

  test.beforeEach(async ({ app, page }) => {
    await page.click('[data-testid="project"]');
    await page.click('text=Create');

    const text = await loadFixture('prerelease-grpc.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.click('button:has-text("Clipboard")');
    await page.click('div[role="dialog"] button:has-text("New")');
    await page.click('text=CollectionPreRelease gRPCjust now');
  });

  test('can send unidirectional requests', async ({ page }) => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
      has: page.locator('.CodeMirror-activeline'),
    });

    await page.click('button:has-text("gRPCUnary")');
    // TODO(filipe): finish implementing
    await page.click('text=Send');
    await expect(statusTag).toContainText('0 OK');
    await expect(responseBody).toContainText('"reply": "hi"');
  });

  test('can send bidirectional requests', async ({ page }) => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
      has: page.locator('.CodeMirror-activeline'),
    });

    await page.click('button:has-text("gRPCBidirectional Stream")');
    // TODO(filipe): finish implementing
    await page.click('text=Send');
    await expect(statusTag).toContainText('0 OK');
    await expect(responseBody).toContainText('"reply": "hi"');
  });

  test('can send client stream requests', async ({ page }) => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
      has: page.locator('.CodeMirror-activeline'),
    });

    await page.click('button:has-text("gRPCClient Stream")');
    // TODO(filipe): finish implementing
    await page.click('text=Send');
    await expect(statusTag).toContainText('0 OK');
    await expect(responseBody).toContainText('"reply": "hi"');
  });

  test('can send server stream requests', async ({ page }) => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
      has: page.locator('.CodeMirror-activeline'),
    });

    await page.click('button:has-text("gRPCServer Stream")');
    // TODO(filipe): finish implementing
    await page.click('text=Send');
    await expect(statusTag).toContainText('0 OK');
    await expect(responseBody).toContainText('"reply": "hi"');
  });

});
