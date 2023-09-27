import { test } from '../../playwright/test';

test('Request tabs', async ({ page }) => {
  await page.getByRole('button', { name: 'New Collection' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

  await page.getByLabel('Create in collection').click();
  await page.getByRole('menuitemradio', { name: 'HTTP Request' }).press('Enter');
  await page.getByRole('button', { name: 'Body' }).click();
  await page.getByRole('menuitem', { name: 'JSON' }).click();
  await page.getByRole('tab', { name: 'Auth' }).click();
  await page.getByRole('button', { name: 'Auth' }).click();
  await page.getByRole('menuitem', { name: 'OAuth 1.0' }).click();
  await page.getByRole('tab', { name: 'Query' }).click();
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
  await page.getByRole('tab', { name: 'JSON' }).click();
  await page.getByRole('menuitem', { name: 'JSON' }).click();
  await page.getByRole('tab', { name: 'Auth' }).click();
  await page.getByRole('tab', { name: 'Query' }).click();
  await page.getByRole('tab', { name: 'Headers' }).click();
  await page.getByRole('tab', { name: 'Docs' }).click();
  await page.getByRole('button', { name: 'Add Description' }).click();
  await page.locator('[data-testid="CodeEditor"] pre[role="presentation"]:has-text("")').click();
  await page.locator('textarea').nth(1).fill('new wss');
});
