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
