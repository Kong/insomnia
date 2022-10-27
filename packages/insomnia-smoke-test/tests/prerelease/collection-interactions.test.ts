import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Request collection', async () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  test.beforeEach(async ({ app, page }) => {
    await page.click('[data-testid="project"]');
    await page.click('text=Create');
    const text = await loadFixture('simple.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.click('button:has-text("Clipboard")');
    await page.click('text=Collectionsimplejust now');
  });

  test.describe('Modals', async () => { // Not sure about the name here
    test('Open environment editor', async ({ page }) => {
      await page.click('#wrapper button:has-text("staging")');
      await page.click('button:has-text("Manage Environments")');
      await page.click('text=Base Environment');
      await page.locator('.btn').first().click();
      // TODO(filipe) add environment editor assertion
      await expect(true).toBe(true);
    });

    test('Open cookie editor modal', async ({ page }) => {
      await page.click('button:has-text("Cookies")');
      await page.locator('text=Manage CookiesFilter CookiesDomainCookieActions localhostfoo=bar; Expires=Tue, 1 >> button').first().click();
      // TODO(filipe) add cookie editor assertion
      await expect(true).toBe(true);
    });

    test('Open custom http method modal', async ({ page }) => {
      await page.click('button:has-text("GETexample http")');
      await page.click('[data-testid="request-pane"] button:has-text("GET")');
      await page.click('button:has-text("Custom Method")');
      await page.locator('[placeholder="CUSTOM"]').fill('aaaa');
      await page.click('text=Done');
      // TODO(filipe) add custom http method modal assertion
      await expect(true).toBe(true);
    });

    // test('Can open quick switch menu', async ({ page }) => {
    //   // TODO(filipe) to be implemented
    // });

  });
});
