import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

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
  await expect(responseBody).toContainText('Closing connection with code 1005');

  // Can connect with Basic Auth
  await page.click('button:has-text("basic-auth")');
  await page.click('text=Connect');
  await expect(statusTag).toContainText('101 Switching Protocols');
  await page.click('[data-testid="response-pane"] >> [role="tab"]:has-text("Timeline")');
  await expect(responseBody).toContainText('> authorization: Basic dXNlcjpwYXNzd29yZA==');

  // Can connect with Bearer Auth
  await page.click('button:has-text("bearer")');
  await page.click('text=Connect');
  await expect(statusTag).toContainText('101 Switching Protocols');
  await page.click('[data-testid="response-pane"] >> [role="tab"]:has-text("Timeline")');
  await expect(responseBody).toContainText('> authorization: Bearer insomnia-cool-token-!!!1112113243111');

  // Can handle redirects
  await page.click('button:has-text("redirect")');
  await page.click('text=Connect');
  await expect(statusTag).toContainText('101 Switching Protocols');
  await page.click('[data-testid="response-pane"] >> [role="tab"]:has-text("Timeline")');
  await expect(responseBody).toContainText('WebSocket connection established');

  const webSocketActiveConnections = page.locator('[data-testid="WebSocketSpinner__Connected"]');

  // Basic auth, Bearer auth, and Redirect connections are displayed as open
  await expect(webSocketActiveConnections).toHaveCount(3);

  // Can disconnect from all connections
  await page.locator('button[name="DisconnectDropdown__DropdownButton"]').click();
  await page.locator('text=Disconnect all requests').click();
  await expect(webSocketActiveConnections).toHaveCount(0);
});
