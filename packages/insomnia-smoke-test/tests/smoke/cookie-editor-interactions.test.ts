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
    await page.getByLabel('simple').click();
  });

  test('create and send a cookie', async ({ page }) => {
    // Open cookie editor
    await page.click('button:has-text("Cookies")');

    // Edit existing cookie
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await page.click('pre[role="presentation"]:has-text("bar")');
    await page.locator('[data-testid="CookieValue"] >> textarea').nth(1).fill('123');
    await page.locator('text=Done').nth(1).click();
    await page.getByTestId('cookie-test-iteration-0').click();

    // Create a new cookie
    await page.getByRole('button', { name: 'Add Cookie' }).click();

    await page.getByRole('button', { name: 'Edit' }).first().click();

    // Try to replace text in Raw view
    await page.getByRole('tab', { name: 'Raw' }).click();
    await page
      .locator('text=Raw Cookie String >> input[type="text"]')
      .fill('foo2=bar2; Expires=Tue, 19 Jan 2038 03:14:07 GMT; Domain=localhost; Path=/');
    await page.locator('text=Done').nth(1).click();
    await page.getByTestId('cookie-test-iteration-0').click();

    await page.click('text=Done');

    // Send http request
    await page.getByLabel('Request Collection').getByTestId('example http').press('Enter');
    await page.click('[data-testid="request-pane"] button:has-text("Send")');

    // Check in the timeline that the cookie was sent

    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.getByText('foo2=bar2')).toBeVisible();

    // Send ws request
    await page.getByLabel('Request Collection').getByTestId('example websocket').press('Enter');
    await page.click('text=ws://localhost:4010');
    await page.click('[data-testid="request-pane"] >> text=Connect');

    // Check in the timeline that the cookie was sent
    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.getByText('foo2=bar2')).toBeVisible();
  });

  test('cookie list should update when cookie is updated', async ({ page }) => {
    // Open cookie editor
    await page.click('button:has-text("Cookies")');

    // Set domain to empty
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await page.getByRole('tab', { name: 'Raw' }).click();
    await page
      .locator('text=Raw Cookie String >> input[type="text"]')
      .fill('foo2=bar2; Expires=Tue, 19 Jan 2038 03:14:07 GMT; Path=/');
    await page.locator('text=Done').nth(1).click();

    await expect.soft(page.getByTestId('cookie-test-iteration-0').getByTestId('cookie-domain')).toBeEmpty();

    // Set domain to example.com
    await page.getByRole('button', { name: 'Edit' }).first().click();
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
