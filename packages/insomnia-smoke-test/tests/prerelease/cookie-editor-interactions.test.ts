import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Cookie editor', async () => {

  test.beforeEach(async ({ app, page }) => {
    await page.click('[data-testid="project"] >> text=Insomnia');
    await page.click('text=Create');
    const text = await loadFixture('simple.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.click('button:has-text("Clipboard")');
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
    await page.locator('text=Done').click();

    // Create a new cookie
    // TODO(filipe)

    // Send http request
    await page.click('button:has-text("GETexample http")');
    await page.click('[data-testid="request-pane"] button:has-text("Send")');

    // Check in the timeline that the cookie was sent
    await page.click('text=Timeline');
    await page.click('text=foo=b123ar');

    // Send ws request
    // TODO(filipe)

    // Check in the timeline that the cookie was sent
    // TODO(filipe)
  });

});
