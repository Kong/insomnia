import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Cookie editor', () => {
  test.beforeEach(async ({ app, page }) => {
    const text = await loadFixture('simple.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  });

  test('create and send a cookie', async ({ page, insomnia }) => {
    // Open cookie editor
    await page.getByRole('button', { name: 'Cookies' }).click();

    // Edit existing cookie
    await page.getByTestId('cookie-test-iteration-0').getByRole('button', { name: 'Edit' }).click();
    await page.locator('pre[role="presentation"]').filter({ hasText: 'bar' }).click();
    await page.locator('[data-testid="CookieValue"] >> textarea').nth(1).fill('123');
    await page.locator('text=Done').nth(1).click();
    await page.getByTestId('cookie-test-iteration-0').click();

    // Create a new cookie
    await page.getByLabel('Cookies Modal').getByRole('button', { name: 'Add Cookie' }).click();

    await page.getByTestId('cookie-test-iteration-0').getByRole('button', { name: 'Edit' }).click();

    // Try to replace text in Raw view
    await page.getByRole('tab', { name: 'Raw' }).click();
    await page
      .locator('text=Raw Cookie String >> input[type="text"]')
      .fill('foo2=bar2; Expires=Tue, 19 Jan 2038 03:14:07 GMT; Domain=localhost; Path=/');
    await page.locator('text=Done').nth(1).click();
    await page.getByTestId('cookie-test-iteration-0').click();

    await page.getByText('Done').click();

    // Send http request
    await insomnia.navigationSidebar.clickRequestOrFolder('example http');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // Check in the timeline that the cookie was sent

    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.getByText('foo2=bar2')).toBeVisible();

    // Send ws request
    await insomnia.navigationSidebar.clickRequestOrFolder('example websocket');
    // Click inside the request-pane URL bar to avoid strict-mode violation from the response pane's URL copy
    await page.locator('pre').filter({ hasText: 'ws://localhost:' }).click();
    await page.getByRole('button', { name: 'Connect' }).click();

    // Check in the timeline that the cookie was sent
    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.getByText('foo2=bar2')).toBeVisible();
  });

  test('support __Host- prefix', async ({ page, insomnia }) => {
    // Open cookie editor
    await page.getByRole('button', { name: 'Cookies' }).click();

    // Create a new cookie
    await page.getByLabel('Cookies Modal').getByRole('button', { name: 'Add Cookie' }).click();

    // Edit the new cookie
    await page.getByTestId('cookie-test-iteration-0').getByRole('button', { name: 'Edit' }).click();
    await page.getByText('HostOnly').click();
    await expect.soft(page.locator('input[name="hostOnly"]')).toBeChecked();
    await page.getByRole('tab', { name: 'Raw' }).click();
    await page
      .locator('text=Raw Cookie String >> input[type="text"]')
      .fill('__Host-foo=bar; Expires=Tue, 19 Jan 2038 03:14:07 GMT; Secure; Domain=localhost; Path=/');
    await page.locator('text=Done').nth(1).click();
    await page.getByText('Done').click();

    // Send request
    await insomnia.navigationSidebar.clickRequestOrFolder('example http');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // Check in the timeline that the cookie was sent
    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.getByText('__Host-foo=bar')).toBeVisible();
  });

  test('cookie list should update when cookie is updated', async ({ page, insomnia }) => {
    // Open cookie editor
    await page.getByRole('button', { name: 'Cookies' }).click();

    // Set domain to empty
    await page.getByTestId('cookie-test-iteration-0').getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('tab', { name: 'Raw' }).click();
    await page
      .locator('text=Raw Cookie String >> input[type="text"]')
      .fill('foo2=bar2; Expires=Tue, 19 Jan 2038 03:14:07 GMT; Path=/');
    await page.locator('text=Done').nth(1).click();

    await expect.soft(page.getByTestId('cookie-test-iteration-0').getByTestId('cookie-domain')).toBeEmpty();

    // Set domain to example.com
    await page.getByTestId('cookie-test-iteration-0').getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('tab', { name: 'Raw' }).click();
    await page
      .locator('text=Raw Cookie String >> input[type="text"]')
      .fill('foo2=bar2; Expires=Tue, 19 Jan 2038 03:14:07 GMT; Path=/; Domain=example.com');
    await page.locator('text=Done').nth(1).click();

    await expect
      .soft(page.getByTestId('cookie-test-iteration-0').getByTestId('cookie-domain'))
      .toHaveText('example.com');
  });
});
