import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('Preferences through click', async ({ page }) => {
  await page.getByTestId('settings-button').click();
  await page.locator('text=Insomnia Preferences').first().click();
});

test('Preferences through keyboard shortcut', async ({ page }) => {
  await page.locator('.app').press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');
  await page.locator('text=Insomnia Preferences').first().click();
});

// Quick reproduction for Kong/insomnia#5664 and INS-2267
test('Check filter responses by environment preference', async ({ app, page }) => {
  const text = await loadFixture('simple.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByLabel('simple').click();

  // Send a request
  await page.getByLabel('Request Collection').getByTestId('example http').press('Enter');
  await page.click('[data-testid="request-pane"] button:has-text("Send")');
  await page.click('text=Console');
  await page.locator('text=HTTP/1.1 200 OK').click();

  // Set filter responses by environment
  await page.getByTestId('settings-button').click();
  await page.locator('text=Insomnia Preferences').first().click();
  await page.locator('text=Filter responses by environment').click();
  await page.locator('.app').press('Escape');

  // Re-send the request and check timeline
  await page.locator('[data-testid="request-pane"] button:has-text("Send")').click();
  await page.click('text=Console');
  await page.locator('text=HTTP/1.1 200 OK').click();
});

test('Enable http and https proxies', async ({ app, page }) => {
  const responsePane = page.getByTestId('response-pane');

  await page.getByTestId('settings-button').click();
  await page.locator('text=Insomnia Preferences').first().click();
  await page.locator('[name="timeout"]').fill('1000');

  await page.getByRole('tab', { name: 'Proxy' }).click();
  await page.locator('text=Enable proxy').click();
  await page.locator('[name="httpProxy"]').fill('127.0.0.1:1111');
  await page.locator('[name="httpsProxy"]').fill('127.0.0.1:2222');
  await page.locator('[name="noProxy"]').fill('');
  await page.locator('.app').press('Escape');

  const text = await loadFixture('simple.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByLabel('simple').click();

  // send the request and check timeline
  await page.getByLabel('Request Collection').getByTestId('proxyEnabled').press('Enter');
  await page.locator('[data-testid="request-pane"] button:has-text("Send")').click();
  await page.click('text=Console');
  await expect.soft(responsePane).toContainText('Trying 127.0.0.1:1111'); // updated proxy
});
