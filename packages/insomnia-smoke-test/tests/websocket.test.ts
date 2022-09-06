import { expect } from '@playwright/test';

import { loadFixture } from '../playwright/paths';
import { test } from '../playwright/test';

test('can make websocket connection', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  await page.click('[data-testid="project"]');
  await page.click('text=Create');

  const text = await loadFixture('websockets.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.click('button:has-text("Clipboard")');
  await page.click('text=CollectionWebSocketsjust now');

  await page.click('button:has-text("localhost:4010")');
  await page.click('text=Connect');
  await expect(statusTag).toContainText('101 Switching Protocols');
  await page.click('[data-testid="response-pane"] >> [role="tab"]:has-text("Timeline")');
  await expect(responseBody).toContainText('WebSocket connection established');

  await page.click('text=Disconnect');
});
