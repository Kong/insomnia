import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('gRPC interactions', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('can send all types of requests', async ({ page, app, insomnia }) => {
    const text = await loadFixture('grpc.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
      has: page.locator('.CodeMirror-activeline'),
    });
    const streamMessage = page.locator('[data-testid="request-pane"] button:has-text("Stream")');

    await insomnia.navigationSidebar.clickRequestOrFolder('Unary');
    await page.locator('[data-testid="request-pane"] >> text=Unary').click();
    await page.click('text=Send');

    // Check for the single Unary response
    await page.getByRole('tab', { name: 'Response 1', exact: true }).click();
    await expect.soft(statusTag).toContainText('0 OK');
    await expect.soft(responseBody).toContainText('Berkshire Valley Management Area Trail');

    await insomnia.navigationSidebar.clickRequestOrFolder('Bidirectional Stream');
    await page.locator('text=Bi-directional Streaming').click();
    await page.click('text=Start');

    // Stream 3 client messages
    await streamMessage.click();
    await streamMessage.click();
    await streamMessage.click();

    // Check for the 3rd stream and response
    await page.getByRole('tab', { name: 'Stream 3', exact: true }).click();
    await page.getByRole('tab', { name: 'Response 3', exact: true }).click();

    // Finish the stream
    await page.locator('text=Commit').click();
    await expect.soft(statusTag).toContainText('0 OK');

    await insomnia.navigationSidebar.clickRequestOrFolder('Client Stream');
    await page.click('text=Client Streaming');
    await page.click('text=Start');

    // Stream 3 client messages
    await streamMessage.click();
    await streamMessage.click();
    await streamMessage.click();

    // Finish the stream and check response
    await page.locator('text=Commit').click();
    await page.getByRole('tab', { name: 'Stream 3', exact: true }).click();
    await page.getByRole('tab', { name: 'Response 1', exact: true }).click();
    await expect.soft(statusTag).toContainText('0 OK');
    await expect.soft(responseBody).toContainText('point_count": 3');

    await insomnia.navigationSidebar.clickRequestOrFolder('Server Stream');
    await page.click('text=Server Streaming');
    await page.click('text=Start');

    // Check response
    await expect.soft(statusTag).toContainText('0 OK');
    await expect.soft(responseBody).toContainText('Patriots Path');
    await page.getByRole('tab', { name: 'Response 64', exact: true }).click();
  });
});
