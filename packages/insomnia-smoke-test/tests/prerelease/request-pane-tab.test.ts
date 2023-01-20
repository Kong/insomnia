import { test } from '../../playwright/test';

test('Select body dropdown', async ({ page }) => {
  await page.getByRole('button', { name: 'Body' }).click();
  await page.getByRole('menuitem', { name: 'JSON' }).click();
});

test('Select auth dropdown', async ({ page }) => {
  await page.getByRole('tab', { name: 'Auth' }).click();
  await page.getByRole('button', { name: 'Auth' }).click();
  await page.getByRole('menuitem', { name: 'OAuth 1.0' }).click();
});
test('Open query parameters', async ({ page }) => {
  await page.getByRole('tab', { name: 'Query' }).click();
  await page.getByRole('tab', { name: 'Headers' }).click();
});

test('Open headers', async ({ page }) => {
  await page.getByRole('tab', { name: 'Headers' }).click();
});

test('Open docs', async ({ page }) => {
  await page.getByRole('tab', { name: 'Docs' }).click();
});

test('Add description to docs', async ({ page }) => {
  await page.getByRole('tab', { name: 'Docs' }).click();
  await page.locator('text=Add Description').click();
  await page.locator('[data-testid="CodeEditor"] pre[role="presentation"]:has-text("")').click();
  await page.locator('textarea').nth(1).fill('new request'); // this works
  // TODO - fix the locator so we don't rely on `.nth(1)` https://linear.app/insomnia/issue/INS-2255/revisit-codemirror-playwright-selectorfill
});

test('WS select body type dropdown', async ({ page }) => {
  await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  await page.getByRole('menuitem', { name: 'WebSocket Request' }).click();
  await page.getByRole('tab', { name: 'JSON' }).click();
  await page.getByRole('menuitem', { name: 'JSON' }).click();
});

test('WS select auth type dropdown', async ({ page }) => {
  await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  await page.getByRole('menuitem', { name: 'WebSocket Request' }).click();
  await page.getByRole('tab', { name: 'Auth' }).click();
});

test('WS open query parameters', async ({ page }) => {
  await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  await page.getByRole('menuitem', { name: 'WebSocket Request' }).click();
  await page.getByRole('tab', { name: 'Query' }).click();
});

test('WS open headers', async ({ page }) => {
  await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  await page.getByRole('menuitem', { name: 'WebSocket Request' }).click();
  await page.getByRole('tab', { name: 'Headers' }).click();
});

test('WS open docs', async ({ page }) => {
  await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  await page.getByRole('menuitem', { name: 'WebSocket Request' }).click();
  await page.getByRole('tab', { name: 'Docs' }).click();

});

test('WS add description', async ({ page }) => {
  await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  await page.getByRole('menuitem', { name: 'WebSocket Request' }).click();
  await page.getByRole('tab', { name: 'Docs' }).click();
  await page.getByRole('button', { name: 'Add Description' }).click();
  await page.locator('[data-testid="CodeEditor"] pre[role="presentation"]:has-text("")').click();
  await page.locator('textarea').nth(1).fill('new wss');
  // TODO - fix the locator so we don't rely on `.nth(1)` https://linear.app/insomnia/issue/INS-2255/revisit-codemirror-playwright-selectorfill
});
