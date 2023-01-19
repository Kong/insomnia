import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Cookie editor', async () => {

  test.beforeEach(async ({ app, page }) => {
    await page.getByTestId('project').click();
    await page.getByRole('button', { name: 'Create' }).click();
    const text = await loadFixture('simple.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByRole('menuitem', { name: 'Clipboard' }).click();
    await page.click('text=Collectionsimplejust now');
  });

  test('create and send a cookie', async ({ page }) => {

    // Open cookie editor
    await page.click('button:has-text("Cookies")');

    // Edit existing cookie
    await page.click('button:has-text("Edit")');
    await page.click('pre[role="presentation"]:has-text("bar")');
    await page.locator('[data-testid="CookieValue"] >> textarea').nth(1).fill('123');
    await page.locator('text=Done').nth(1).click();

    // Create a new cookie
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Add Cookie' }).click();
    await page.getByText('Edit').first().click();

    // Try to replace text in Raw view
    await page.getByRole('tab', { name: 'Raw' }).click();
    await page.locator('text=Raw Cookie String >> input[type="text"]').fill('foo2=bar2; Expires=Tue, 19 Jan 2038 03:14:07 GMT; Domain=localhost; Path=/');

    await page.locator('text=Done').nth(1).click();
    await page.click('text=Done');

    // Send http request
    await page.getByRole('button', { name: 'example http' }).click();
    await page.click('[data-testid="request-pane"] button:has-text("Send")');

    // Check in the timeline that the cookie was sent
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await page.click('text=foo2=bar2; foo=b123ar');

    // Send ws request
    await page.getByRole('button', { name: 'example websocket' }).click();
    await page.click('text=ws://localhost:4010');
    await page.click('[data-testid="request-pane"] >> text=Connect');

    // Check in the timeline that the cookie was sent
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await page.click('text=foo2=bar2; foo=b123ar;');
  });

});
