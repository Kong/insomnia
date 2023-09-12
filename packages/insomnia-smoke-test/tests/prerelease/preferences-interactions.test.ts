import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('Preferences through click', async ({ page }) => {
  await page.locator('[data-testid="settings-button"]').click();
  await page.locator('text=Insomnia Preferences').first().click();
});

test('Preferences through keyboard shortcut', async ({ page }) => {
  if (process.platform === 'darwin') {
    await page.locator('.app').press('Meta+,');
  } else {
    await page.locator('.app').press('Control+,');
  }
  await page.locator('text=Insomnia Preferences').first().click();
});

// Quick reproduction for Kong/insomnia#5664 and INS-2267
test('Check filter responses by environment preference', async ({ app, page }) => {
  await page.getByRole('button', { name: 'Create in project' }).click();
  const text = await loadFixture('simple.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByRole('menuitemradio', { name: 'Import' }).click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByText('Collectionsimplejust now').click();

  // Send a request
  await page.getByLabel('Request Collection').getByRole('row', { name: 'example http' }).click();
  await page.click('[data-testid="request-pane"] button:has-text("Send")');
  await page.click('text=Timeline');
  await page.locator('text=HTTP/1.1 200 OK').click();

  // Set filter responses by environment
  await page.locator('[data-testid="settings-button"]').click();
  await page.locator('text=Insomnia Preferences').first().click();
  await page.locator('text=Filter responses by environment').click();
  await page.locator('.app').press('Escape');

  // Re-send the request and check timeline
  await page.locator('[data-testid="request-pane"] button:has-text("Send")').click();
  await page.click('text=Timeline');
  await page.locator('text=HTTP/1.1 200 OK').click();
});
