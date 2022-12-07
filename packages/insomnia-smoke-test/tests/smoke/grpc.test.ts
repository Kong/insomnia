import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can send gRPC requests', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  await page.click('[data-testid="project"]');
  await page.click('text=Create');

  const text = await loadFixture('grpc.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.click('button:has-text("Clipboard")');
  await page.click('div[role="dialog"] button:has-text("New")');
  await page.click('text=CollectionPreRelease gRPCjust now');
  await page.locator('button:has-text("Route Guide ExampleOPEN")').click();
  await page.click('button:has-text("gRPCUnary")');
  await page.locator('[data-testid="request-pane"] >> text=Unary').click();
  await page.click('text=Send');

  // Check for the single Unary response
  await page.click('text=Response 1');
  await expect(statusTag).toContainText('0 OK');
  await expect(responseBody).toContainText('Berkshire Valley Management Area Trail');
});
