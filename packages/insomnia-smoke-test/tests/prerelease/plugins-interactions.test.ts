import { test } from '../../playwright/test';

test.describe('Plugins', async () => {
  test('Open plugins menu and generate plugin', async ({ page }) => {
    // Opening settings
    await page.locator('[data-testid="settings-button"]').click();
    // Switching to Plugins tab
    await page.locator('div[role="tab"]:has-text("Plugins")').click();

    // Generate new plugin
    await page.locator('text=Generate New Plugin').click();
    await page.locator('text=Generate').first().click();

    // check if the plugin shows up on the plugin list
    await page.getByRole('cell', { name: 'insomnia-plugin-demo-example' }).click();
  });
});
