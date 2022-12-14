import { expect, Locator } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('gRPC interactions', () => {

  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  let statusTag: Locator;
  let responseBody: Locator;
  let streamMessage: Locator;

  test.beforeEach(async ({ app, page }) => {
    await page.click('[data-testid="project"]');
    await page.click('text=Create');

    const text = await loadFixture('grpc.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.click('button:has-text("Clipboard")');
    await page.click('text=CollectionPreRelease gRPCjust now');
    statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
      has: page.locator('.CodeMirror-activeline'),
    });
    streamMessage = page.locator('[data-testid="request-pane"] button:has-text("Stream")');
    await page.locator('button:has-text("Route Guide ExampleOPEN")').click();
  });

  test('can send unidirectional requests', async ({ page }) => {
    await page.click('button:has-text("gRPCUnary")');
    await page.locator('[data-testid="request-pane"] >> text=Unary').click();
    await page.click('text=Send');

    // Check for the single Unary response
    await page.click('text=Response 1');
    await expect(statusTag).toContainText('0 OK');
    await expect(responseBody).toContainText('Berkshire Valley Management Area Trail');
  });

  test('can send bidirectional requests', async ({ page }) => {
    await page.click('button:has-text("gRPCBidirectional Stream")');
    await page.locator('text=Bi-directional Streaming').click();
    await page.click('text=Start');

    // Stream 3 client messages
    await streamMessage.click();
    await streamMessage.click();
    await streamMessage.click();

    // Check for the 3rd stream and response
    await page.locator('text=Stream 3').click();
    await page.locator('text=Response 3').click();

    // Finish the stream
    await page.locator('text=Commit').click();
    await expect(statusTag).toContainText('0 OK');
  });

  test('can send client stream requests', async ({ page }) => {
    await page.click('button:has-text("gRPCClient Stream")');
    await page.click('text=Client Streaming');
    await page.click('text=Start');

    // Stream 3 client messages
    await streamMessage.click();
    await streamMessage.click();
    await streamMessage.click();

    // Finish the stream and check response
    await page.locator('text=Commit').click();
    await page.locator('text=Stream 3').click();
    await page.locator('text=Response 1').click();
    await expect(statusTag).toContainText('0 OK');
    await expect(responseBody).toContainText('point_count": 3');
  });

  test('can send server stream requests', async ({ page }) => {
    await page.click('button:has-text("gRPCServer Stream")');
    await page.click('text=Server Streaming');
    await page.click('text=Start');

    // Check response
    await expect(statusTag).toContainText('0 OK');
    await page.locator('text=Response 64').click();
    await expect(responseBody).toContainText('3 Hasta Way');
  });

});
