import { expect } from '@playwright/test';

import { loadFixture } from '../playwright/paths';
import { test } from '../playwright/test';

test.describe.parallel('suite', () => {
  test('url field is focused for first time users', async ({ page }) => {
    const urlInput = ':nth-match(textarea, 2)';
    const locator = page.locator(urlInput);
    await expect(locator).toBeFocused();
  });

  test('can send requests', async ({ app, page }) => {
    test.setTimeout(120000);
    const successTag = page.locator('header >> div >> .tag >> text=200 OK');

    await page.click('[data-testid="project"]');
    await page.click('text=Create');

    const text = await loadFixture('smoke-test-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.click('button:has-text("Clipboard")');
    await page.click('text=CollectionSmoke testsjust now');

    await page.click('button:has-text("GETsend JSON request")');
    await page.click('text=http://127.0.0.1:4010/pets/1Send >> button');
    await expect(successTag).toBeVisible();
    // Check Raw data option
    await page.click('button:has-text("Preview")');
    await page.click('button:has-text("Raw Data")');
    await page.click('text=/.*\\{"id":"1"\\}.*/');

    await page.click('button:has-text("GETsends dummy.csv request and shows rich response")');
    await page.click('text=http://127.0.0.1:4010/file/dummy.csvSend >> button');
    await expect(successTag).toBeVisible();

    await page.click('button:has-text("GETsends dummy.xml request and shows raw response")');
    await page.click('text=http://127.0.0.1:4010/file/dummy.xmlSend >> button');
    await expect(successTag).toBeVisible();

    await page.click('button:has-text("GETsends dummy.pdf request and shows rich response")');
    await page.click('text=http://127.0.0.1:4010/file/dummy.pdfSend >> button');
    await expect(successTag).toBeVisible();
    // Check if we load a canvas for the pdf file
    const pdfElement = page.locator('canvas');
    await expect(pdfElement).toBeVisible();

    await page.click('button:has-text("GETsends request with basic authentication")');
    await page.click('text=http://127.0.0.1:4010/auth/basicSend >> button');
    await expect(successTag).toBeVisible();

    // Send request, check if no cookie was sent (server will reply with received cookies + a new cookie as response)
    await page.click('button:has-text("GETsends request with cookie and get cookie in response")');
    await page.click('text=http://127.0.0.1:4010/cookiesSend >> button');
    await expect(successTag).toBeVisible();
    await page.click('text=undefined');
    // Send request, check if new cookie sent by server in previous request is now also sent
    await page.click('text=http://127.0.0.1:4010/cookiesSend >> button');
    await expect(successTag).toBeVisible();
    await page.click('text=insomnia-test-cookie=value123');
  });

  test('can cancel requests', async ({ app, page }) => {
    await page.click('[data-testid="project"]');
    await page.click('text=Create');

    const text = await loadFixture('smoke-test-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.click('button:has-text("Clipboard")');
    await page.click('text=CollectionSmoke testsjust now');

    await page.click('button:has-text("GETdelayed request")');
    await page.click('text=http://127.0.0.1:4010/delay/seconds/20Send >> button');
    await page.click('text=Loading...Cancel Request >> button');
    await page.click('text=Request was cancelled');
  });
});
