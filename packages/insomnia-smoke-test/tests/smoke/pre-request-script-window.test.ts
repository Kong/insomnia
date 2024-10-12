import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('test hidden window handling', async () => {
  test('can cancel pre-request script', async ({ app, page }) => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

    const text = await loadFixture('pre-request-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

    await page.getByRole('button', { name: 'Workspace actions menu button' }).click();
    await page.getByRole('menuitem', { name: 'Export' }).click();
    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByText('Which format would you like to export as?').click();
    await page.locator('.app').press('Escape');

    await page.getByText('Pre-request Scripts').click();

    await page.getByLabel('Request Collection').getByTestId('Long running task').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    await page.getByRole('button', { name: 'Cancel Request' }).click();

    // check the response pane message
    await page.click('text=Request was cancelled');
  });

  test('handle hidden browser window getting closed', async ({ app, page }) => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

    const text = await loadFixture('pre-request-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

    await page.getByTestId('settings-button').click();
    await page.getByLabel('Request timeout (ms)').fill('1000');
    await page.getByRole('button', { name: '' }).click();

    await page.getByText('Pre-request Scripts').click();
    await page.getByLabel('Request Collection').getByTestId('Long running task - post').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send', exact: true }).click();

    await page.getByText('Executing script timeout').click();
    await page.getByRole('tab', { name: 'Console' }).click();
    await page.getByRole('tab', { name: 'Preview' }).click();

    const windows = await app.windows();
    const hiddenWindow = windows[1];
    hiddenWindow.close();

    await page.getByTestId('settings-button').click();
    await page.getByLabel('Request timeout (ms)').fill('6000');
    await page.getByRole('button', { name: '' }).click();

    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // it should still work
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    await page.waitForSelector('[data-testid="response-status-tag"]:visible');
    await expect(statusTag).toContainText('200 OK');
  });

  test('window should be restarted if it hangs', async ({ app, page }) => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

    // load collection
    const text = await loadFixture('pre-request-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

    // update timeout
    await page.getByTestId('settings-button').click();
    await page.getByLabel('Request timeout (ms)').fill('5000');
    await page.getByRole('button', { name: '' }).click();

    // send the request with infinite loop script
    await page.getByText('Pre-request Scripts').click();
    await page.getByLabel('Request Collection').getByTestId('infinite loop').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send', exact: true }).click();
    // await page.getByText('Timeout: Hidden browser window is not responding').click();

    await page.getByText('Executing script timeout').click();

    // send the another script with normal script
    await page.getByLabel('Request Collection').getByTestId('simple log').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send', exact: true }).click();

    // it should still work
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    await page.waitForSelector('[data-testid="response-status-tag"]:visible');
    await expect(statusTag).toContainText('200 OK');
  });
});
