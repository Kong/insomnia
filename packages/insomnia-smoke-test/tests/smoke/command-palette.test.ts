import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('Command palette - can switch between requests and workspaces', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  // Import a collection
  const text = await loadFixture('smoke-test-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  // Import a document
  const swaggerDoc = await loadFixture('swagger2.yaml');
  await app.evaluate(async ({ clipboard }, swaggerDoc) => clipboard.writeText(swaggerDoc), swaggerDoc);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await page.getByLabel('Smoke tests').click();
  await page.getByTestId('sends request with cookie and get cookie in response').getByText('GET', { exact: true }).click();
  await page.getByTestId('OneLineEditor').getByText('http://127.0.0.1:4010/cookies').click();
  const requestSwitchKeyboardShortcut = process.platform === 'darwin' ? 'Meta+p' : 'Control+p';
  await page.locator('body').press(requestSwitchKeyboardShortcut);
  await page.getByPlaceholder('Search and switch between').fill('send js');
  await page.getByPlaceholder('Search and switch between').press('ArrowDown');
  await page.getByPlaceholder('Search and switch between').press('Enter');
  await page.getByTestId('OneLineEditor').getByText('http://127.0.0.1:4010/pets/').click();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByText('200 OK').click();

  await page.locator('body').press(requestSwitchKeyboardShortcut);
  await page.getByPlaceholder('Search and switch between').press('ArrowUp');
  await page.getByPlaceholder('Search and switch between').press('ArrowUp');
  await page.getByPlaceholder('Search and switch between').press('Enter');
  await expect(page.getByTestId('workspace-context-dropdown').locator('span')).toContainText('E2E testing specification - swagger 2 1.0.0');
});
