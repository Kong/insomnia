import { test } from '../../playwright/test';

test('Select body dropdown', async ({ page }) => {
  await page.locator('div[role="tab"]:has-text("Body")').click();
  await page.locator('button:has-text("JSON")').click();

});

test('Select auth dropdown', async ({ page }) => {
  await page.locator('div[role="tab"]:has-text("Auth")').click();
  await page.locator('[aria-label="Request pane tabs"] >> text=Auth').click();
  await page.locator('button:has-text("OAuth 1.0")').click();
});
test('Open query parameters', async ({ page }) => {
  await page.locator('[data-testid="request-pane"] >> text=Query').click();
  await page.locator('text=Headers').click();
});

test('Open headers', async ({ page }) => {
  await page.locator('text=Headers').click();

});

test('Open docs', async ({ page }) => {
  await page.locator('text=Docs').click();
});

test('Add description to docs', async ({ page }) => {
  await page.locator('text=Docs').click();
  await page.locator('text=Add Description').click();
  await page.locator('[data-testid="CodeEditor"] pre[role="presentation"]:has-text("")').click();
  await page.locator('textarea').nth(1).fill('new request'); // this works
  // TODO - fix the locator so we don't rely on `.nth(1)` https://linear.app/insomnia/issue/INS-2255/revisit-codemirror-playwright-selectorfill
});

test('WS select body type dropdown', async ({ page }) => {
  await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  await page.locator('button:has-text("WebSocket Request")').first().click();
  await page.locator('[aria-label="Websocket request pane tabs"] >> text=JSON').click();
  await page.locator('#dropdowns-container button:has-text("JSON")').click();
});

test('WS select auth type dropdown', async ({ page }) => {
  await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  await page.locator('button:has-text("WebSocket Request")').first().click();
  await page.locator('div[role="tab"]:has-text("Auth")').click();
});

test('WS open query parameters', async ({ page }) => {
  await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  await page.locator('button:has-text("WebSocket Request")').first().click();
  await page.locator('text=Query').click();
});

test('WS open headers', async ({ page }) => {
  await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  await page.locator('button:has-text("WebSocket Request")').first().click();
  await page.locator('text=Headers').click();
});

test('WS open docs', async ({ page }) => {
  await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  await page.locator('button:has-text("WebSocket Request")').first().click();
  await page.locator('text=Docs').click();

});

test('WS add description', async ({ page }) => {
  await page.locator('[data-testid="SidebarFilter"] [data-testid="SidebarCreateDropdown"] button').click();
  await page.locator('button:has-text("WebSocket Request")').first().click();
  await page.locator('text=Docs').click();
  await page.locator('text=Add Description').click();
  await page.locator('[data-testid="CodeEditor"] pre[role="presentation"]:has-text("")').click();
  await page.locator('textarea').nth(1).fill('new wss');
  // TODO - fix the locator so we don't rely on `.nth(1)` https://linear.app/insomnia/issue/INS-2255/revisit-codemirror-playwright-selectorfill
});
