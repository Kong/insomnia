import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can make websocket connection', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  await page.getByTestId('project').click();
  await page.getByRole('button', { name: 'Create' }).click();

  const text = await loadFixture('websockets.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByRole('menuitem', { name: 'Clipboard' }).click();
  await page.click('text=CollectionWebSocketsjust now');

  await page.getByRole('button', { name: 'localhost:4010' }).click();
  await expect(page.locator('.app')).toContainText('ws://localhost:4010');
  await page.click('text=Connect');
  await expect(statusTag).toContainText('101 Switching Protocols');
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await expect(responseBody).toContainText('WebSocket connection established');
  await page.click('text=Disconnect');
  await expect(responseBody).toContainText('Closing connection with code 1005');

  // Can connect with Basic Auth
  await page.getByRole('button', { name: 'basic-auth' }).click();
  await expect(page.locator('.app')).toContainText('ws://localhost:4010/basic-auth');
  await page.click('text=Connect');
  await expect(statusTag).toContainText('101 Switching Protocols');
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await expect(responseBody).toContainText('> authorization: Basic dXNlcjpwYXNzd29yZA==');

  // Can connect with Bearer Auth
  await page.getByRole('button', { name: 'bearer' }).click();
  await expect(page.locator('.app')).toContainText('ws://localhost:4010/bearer');
  await page.click('text=Connect');
  await expect(statusTag).toContainText('101 Switching Protocols');
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await expect(responseBody).toContainText('> authorization: Bearer insomnia-cool-token-!!!1112113243111');

  // Can handle redirects
  await page.getByRole('button', { name: 'redirect' }).click();
  await expect(page.locator('.app')).toContainText('ws://localhost:4010/redirect');
  await page.click('text=Connect');
  await expect(statusTag).toContainText('101 Switching Protocols');
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await expect(responseBody).toContainText('WebSocket connection established');

  const webSocketActiveConnections = page.locator('[data-testid="WebSocketSpinner__Connected"]');

  // Basic auth, Bearer auth, and Redirect connections are displayed as open
  await expect(webSocketActiveConnections).toHaveCount(3);

  // Can disconnect from all connections
  await page.locator('button[name="DisconnectDropdown__DropdownButton"]').click();
  await page.getByRole('menuitem', { name: 'Disconnect all requests' }).click();
  await expect(webSocketActiveConnections).toHaveCount(0);
});
