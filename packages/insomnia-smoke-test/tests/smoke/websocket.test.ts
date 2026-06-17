import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can make websocket connection', async ({ app, page, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  const text = await loadFixture('websockets.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await insomnia.navigationSidebar.clickRequestOrFolder('localhost:4010');
  await expect.soft(page.locator('.app')).toContainText('ws://localhost:4010');
  await page.click('text=Connect');
  await expect.soft(statusTag).toContainText('101 Switching Protocols');
  await page.getByRole('tab', { name: 'Console' }).click();
  await expect.soft(responseBody).toContainText('WebSocket connection established');
  await page.click('text=Disconnect');
  await expect.soft(responseBody).toContainText('Closing connection with code 1005');

  // Can connect with Basic Auth
  await insomnia.navigationSidebar.clickRequestOrFolder('basic-auth');
  await expect.soft(page.locator('.app')).toContainText('ws://localhost:4010/basic-auth');
  await page.click('text=Connect');
  await expect.soft(statusTag).toContainText('101 Switching Protocols');
  await page.getByRole('tab', { name: 'Console' }).click();
  await expect.soft(responseBody).toContainText('> authorization: Basic dXNlcjpwYXNzd29yZA==');

  // Can connect with Bearer Auth
  await insomnia.navigationSidebar.clickRequestOrFolder('bearer');
  await expect.soft(page.locator('.app')).toContainText('ws://localhost:4010/bearer');
  await page.click('text=Connect');
  await expect.soft(statusTag).toContainText('101 Switching Protocols');
  await page.getByRole('tab', { name: 'Console' }).click();
  await expect.soft(responseBody).toContainText('> authorization: Bearer insomnia-cool-token-!!!1112113243111');

  // Can handle redirects
  await insomnia.navigationSidebar.clickRequestOrFolder('redirect');
  await expect.soft(page.locator('.app')).toContainText('ws://localhost:4010/redirect');
  await page.click('text=Connect');
  await expect.soft(statusTag).toContainText('101 Switching Protocols');
  await page.getByRole('tab', { name: 'Console' }).click();
  await expect.soft(responseBody).toContainText('WebSocket connection established');

  // Can connect with path parameters substituted in the URL
  await insomnia.navigationSidebar.clickRequestOrFolder('path-param');
  await expect.soft(page.locator('.app')).toContainText('ws://localhost:4010/chat/:id');
  await page.click('text=Connect');
  await expect.soft(statusTag).toContainText('101 Switching Protocols');
  await page.getByRole('tab', { name: 'Console' }).click();
  await expect.soft(responseBody).toContainText('WebSocket connection established');

  const webSocketActiveConnections = page.getByTestId('WebSocketSpinner__Connected');

  // Basic auth, Bearer auth, Redirect, and path-param connections are displayed as open
  await expect.soft(webSocketActiveConnections).toHaveCount(4);

  // Can disconnect from all connections
  await page.locator('button[name="DisconnectDropdown__DropdownButton"]').click();
  await page.getByRole('menuitem', { name: 'Disconnect all requests' }).click();
  await expect.soft(webSocketActiveConnections).toHaveCount(0);
});
