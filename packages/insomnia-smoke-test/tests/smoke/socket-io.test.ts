import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can make socket.io connection', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  const text = await loadFixture('socket-io.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByLabel('Socket.io Collection').click();

  await page.getByLabel('Request Collection').getByTestId('Socket.IO Request').press('Enter');
  await expect.soft(page.locator('.app')).toContainText('http://localhost:4020');
  await page.click('text=Connect');
  await expect.soft(statusTag).toContainText('Connected');
  await page.getByRole('tab', { name: 'Console' }).click();
  await expect.soft(responseBody).toContainText('Connected to http://localhost:4020');
  await page.click('text=Disconnect');
  await expect.soft(responseBody).toContainText('io client disconnect');

  await page.click('text=Connect');
  const connections = page.getByTestId('SocketIOSpinner__Connected');
  await expect.soft(connections).toHaveCount(1);

  // Can disconnect from all connections
  await page.locator('button[name="DisconnectDropdown__DropdownButton"]').click();
  await page.getByRole('menuitem', { name: 'Disconnect all requests' }).click();
  await expect.soft(connections).toHaveCount(0);
});
