import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can send gRPC requests with reflection', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  await page.getByTestId('project').click();
  await page.getByRole('button', { name: 'Create' }).click();

  const text = await loadFixture('grpc.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByRole('menuitem', { name: 'Clipboard' }).click();
  await page.click('text=CollectionPreRelease gRPCjust now');
  await page.getByRole('button', { name: 'Route Guide Example' }).click();

  await page.getByRole('button', { name: 'UnaryWithOutProtoFile' }).click();
  await expect(page.getByRole('button', { name: 'Select Method' })).toBeDisabled();
  await page.getByTestId('button-server-reflection').click();

  await page.getByRole('button', { name: 'Select Method' }).click();
  await page.getByRole('menuitem', { name: 'RouteGuide/GetFeature' }).click();

  await page.getByRole('tab', { name: 'Unary' }).click();
  await page.getByRole('button', { name: 'Send' }).click();

  // Check for the single Unary response
  await page.getByRole('tab', { name: 'Response 1' }).click();
  await expect(statusTag).toContainText('0 OK');
  await expect(responseBody).toContainText('Berkshire Valley Management Area Trail');
});
