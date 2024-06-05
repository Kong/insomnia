import { test } from '../../playwright/test';

test('Request tabs', async ({ page }) => {
  await page.getByRole('button', { name: 'New Collection' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

  await page.getByLabel('Create in collection').click();
  await page.getByRole('menuitemradio', { name: 'HTTP Request' }).press('Enter');
  await page.getByRole('tab', { name: 'Body' }).click();
  await page.getByRole('button', { name: 'Body' }).click();
  await page.getByRole('option', { name: 'JSON' }).click();
  await page.getByRole('tab', { name: 'Auth' }).click();
  await page.getByRole('button', { name: 'Auth' }).click();
  await page.getByLabel('OAuth 1.0', { exact: true }).click();
  await page.getByRole('tab', { name: 'Params' }).click();
  await page.getByRole('tab', { name: 'Headers' }).click();
  await page.getByRole('tab', { name: 'Docs' }).click();
  await page.locator('text=Add Description').click();
  await page.locator('[data-testid="CodeEditor"] pre[role="presentation"]:has-text("")').click();
  await page.locator('textarea').nth(1).fill('new request');
});

test('WS tabs', async ({ page }) => {
  await page.getByRole('button', { name: 'New Collection' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

  await page.getByLabel('Create in collection').click();
  await page.getByRole('menuitemradio', { name: 'WebSocket Request' }).click();
  await page.getByRole('tab', { name: 'Body' }).click();
  await page.getByRole('button', { name: 'JSON' }).click();
  await page.getByRole('option', { name: 'JSON' }).click();
  await page.getByRole('tab', { name: 'Auth' }).click();
  await page.getByRole('tab', { name: 'Params' }).click();
  await page.getByRole('tab', { name: 'Headers' }).click();
  await page.getByRole('tab', { name: 'Docs' }).click();
  await page.getByRole('button', { name: 'Add Description' }).click();
  await page.locator('[data-testid="CodeEditor"] pre[role="presentation"]:has-text("")').click();
  await page.locator('textarea').nth(1).fill('new wss');
});
