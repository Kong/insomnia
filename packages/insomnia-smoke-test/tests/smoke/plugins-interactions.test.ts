import { test } from '../../playwright/test';
import { expect } from '@playwright/test';

test.describe('Plugins', () => {
  test.beforeEach(async ({ page }) => {
    // Opening settings
    await page.getByTestId('settings-button').click();
    // Switching to Plugins tab
    await page.locator('div[role="tab"]:has-text("Plugins")').click();
  });

  test('Generate a new valid plugin', async ({ page }) => {
    await page.locator('text=Generate New Plugin').click();
    await page.getByLabel('Plugin name').fill('demo-example');
    await page.locator('text=Generate').first().click();
    await expect(page.getByRole('cell', { name: 'insomnia-plugin-demo-example' })).toBeVisible();
  });

  test('Reject plugin name with uppercase letters', async ({ page }) => {
    await page.locator('text=Generate New Plugin').click();
    await page.getByLabel('Plugin name').fill('My-Plugin');
    await page.locator('text=Generate').first().click();
    await expect(page.locator('text=Plugin name must be of format my-plugin-name')).toBeVisible();
  });

  test('Reject plugin name with consecutive dashes', async ({ page }) => {
    await page.locator('text=Generate New Plugin').click();
    await page.getByLabel('Plugin name').fill('my--plugin');
    await page.locator('text=Generate').first().click();
    await expect(page.locator('text=Plugin name must not contain consecutive dashes')).toBeVisible();
  });

  test('Reject plugin name starting with dash', async ({ page }) => {
    await page.locator('text=Generate New Plugin').click();
    await page.getByLabel('Plugin name').fill('-plugin');
    await page.locator('text=Generate').first().click();
    await expect(page.locator('text=Plugin name must not start with a dash')).toBeVisible();
  });

  test('Reject plugin name ending with dash', async ({ page }) => {
    await page.locator('text=Generate New Plugin').click();
    await page.getByLabel('Plugin name').fill('plugin-');
    await page.locator('text=Generate').first().click();
    await expect(page.locator('text=Plugin name must not end with a dash')).toBeVisible();
  });

  test('Reject plugin name that is a single dash', async ({ page }) => {
    await page.locator('text=Generate New Plugin').click();
    await page.getByLabel('Plugin name').fill('-');
    await page.locator('text=Generate').first().click();
    await expect(page.locator('text=Plugin name must not be a single dash')).toBeVisible();
  });

  test('Reject plugin name with special characters', async ({ page }) => {
    await page.locator('text=Generate New Plugin').click();
    await page.getByLabel('Plugin name').fill('plug!n');
    await page.locator('text=Generate').first().click();
    await expect(page.locator('text=Plugin name must only contain letters, numbers and dashes')).toBeVisible();
  });

  test('Prevent creating a plugin with a name that already exists', async ({ page }) => {
    const pluginName = 'duplicate-plugin';
    await page.locator('text=Generate New Plugin').click();
    await page.getByLabel('Plugin name').fill(pluginName);
    await page.locator('text=Generate').first().click();
    await expect(page.getByRole('cell', { name: `insomnia-plugin-${pluginName}` })).toBeVisible();

    // Try to generate the same plugin again
    await page.locator('text=Generate New Plugin').click();
    await page.getByLabel('Plugin name').fill(pluginName);
    await page.locator('text=Generate').first().click();
    await expect(page.locator('text=Plugin already exists')).toBeVisible(); // this assumes your backend returns that
  });
});
