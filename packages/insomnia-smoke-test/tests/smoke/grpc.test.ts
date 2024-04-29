import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('test grpc requests', async () => {
  test('test unary request', async ({ app, page }) => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
      has: page.locator('.CodeMirror-activeline'),
    });

    await page.getByRole('button', { name: 'Create in project' }).click();

    const text = await loadFixture('grpc.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.getByRole('menuitemradio', { name: 'Import' }).click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByLabel('PreRelease gRPC').click();

    // choose request
    await page.getByLabel('Request Collection').getByTestId('UnaryWithOutProtoFile').press('Enter');
    await expect(page.getByRole('button', { name: 'Select Method' })).toBeDisabled();
    await page.getByTestId('button-server-reflection').click();

    // choose method
    await page.getByRole('button', { name: 'Select Method' }).click();
    await page.getByLabel('/RouteGuide/GetFeature', { exact: true }).click();

    // start
    await page.getByRole('button', { name: 'Send' }).click();

    // verify
    await page.getByRole('tab', { name: 'Response 1' }).click();
    await expect(statusTag).toContainText('0 OK');
    await expect(responseBody).toContainText('Berkshire Valley Management Area Trail');
  });

  test('test client side stream', async ({ app, page }) => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
      has: page.locator('.CodeMirror-activeline'),
    });

    await page.getByRole('button', { name: 'Create in project' }).click();

    // import collection
    const text = await loadFixture('grpc.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByRole('menuitemradio', { name: 'Import' }).click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByLabel('PreRelease gRPC').click();

    // choose request
    await page.getByLabel('Request Collection').getByTestId('UnaryWithOutProtoFile').press('Enter');
    await expect(page.getByRole('button', { name: 'Select Method' })).toBeDisabled();
    await page.getByTestId('button-server-reflection').click();

    // choose method
    await page.getByRole('button', { name: 'Select Method' }).click();
    await page.getByLabel('/RouteGuide/RecordRoute', { exact: true }).click();

    // start
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('button', { name: 'Commit' }).click();

    // verify
    await page.getByRole('tab', { name: 'Response 1' }).click();
    await expect(statusTag).toContainText('0 OK');
    await expect(responseBody).toContainText('point_count": 0');
  });

  test('test bidirectional stream', async ({ app, page }) => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');

    await page.getByRole('button', { name: 'Create in project' }).click();

    // import collection
    const text = await loadFixture('grpc.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByRole('menuitemradio', { name: 'Import' }).click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByText('CollectionPreRelease gRPCjust now').click();

    // choose request
    await page.getByLabel('Request Collection').getByTestId('UnaryWithOutProtoFile').press('Enter');
    await expect(page.getByRole('button', { name: 'Select Method' })).toBeDisabled();
    await page.getByTestId('button-server-reflection').click();

    // choose method
    await page.getByRole('button', { name: 'Select Method' }).click();
    await page.getByLabel('/RouteGuide/RouteChat', { exact: true }).click();

    // start
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('button', { name: 'Commit' }).click();

    // verify
    await expect(statusTag).toContainText('0 OK');
  });
});
