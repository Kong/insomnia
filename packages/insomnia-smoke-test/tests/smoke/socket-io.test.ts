import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can make socket.io connection', async ({ app, page, insomnia }) => {
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

  await insomnia.navigationSidebar.clickRequestOrFolder('Socket.IO Request');
  await expect.soft(page.locator('.app')).toContainText('http://localhost:4020');

  // The body lives in its own document, so it only survives the import if the v5 file carries it.
  // Params is the initially selected tab and react-aria unmounts the panels it is not showing,
  // so the Body tab has to be opened before any of it can be asserted.
  await page.getByRole('tab', { name: 'Body' }).click();
  await expect.soft(page.getByLabel('Event Name')).toHaveValue('hello');
  await expect.soft(page.locator('[data-testid="CodeEditor"]:visible').first()).toContainText('world');

  await page.click('text=Connect');
  await expect.soft(statusTag).toContainText('Connected', { ignoreCase: true });
  await page.getByRole('tab', { name: 'Console' }).click();
  await expect.soft(responseBody).toContainText('Connecting to http://localhost:4020');
  await page.click('text=Disconnect');
  await expect.soft(responseBody).toContainText('io client disconnect');

  await page.click('text=Connect');
  const connections = page.getByTestId('SocketIOSpinner__Connected');
  await expect.soft(connections).toHaveCount(1);

  await page.click('text=Disconnect');
  await expect.soft(connections).toHaveCount(0);
});
