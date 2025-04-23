import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('Plugins', async ({ page }) => {
  // Opening settings
  await page.getByTestId('settings-button').click();
  // Switching to Plugins tab
  await page.locator('div[role="tab"]:has-text("Plugins")').click();

  // Generate a new valid plugin
  await page.locator('text=Generate New Plugin').click();
  await page.getByLabel('Plugin name').fill('demo-example');
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.getByRole('cell', { name: 'insomnia-plugin-demo-example' })).toBeVisible();

  // Reject plugin name with uppercase letters
  await page.locator('text=Generate New Plugin').click();
  await page.getByLabel('Plugin name').fill('My-Plugin');
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin name must be of format my-plugin-name')).toBeVisible();

  // Reject plugin name with consecutive dashes
  await page.getByLabel('Plugin name').fill('my--plugin');
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin name must not contain consecutive dashes')).toBeVisible();

  // Reject plugin name starting with dash
  await page.getByLabel('Plugin name').fill('-plugin');
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin name must not start with a dash')).toBeVisible();

  // Reject plugin name ending with dash
  await page.getByLabel('Plugin name').fill('plugin-');
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin name must not end with a dash')).toBeVisible();

  //  Reject plugin name that is a single dash
  await page.getByLabel('Plugin name').fill('-');
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin name must not be a single dash')).toBeVisible();

  // Prevent creating a plugin with a name that already exists
  const pluginName = 'duplicate-plugin';
  await page.getByLabel('Plugin name').fill(pluginName);
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.getByRole('cell', { name: `insomnia-plugin-${pluginName}` })).toBeVisible();

  // Try to generate the same plugin again
  await page.locator('text=Generate New Plugin').click();
  await page.getByLabel('Plugin name').fill(pluginName);
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin already exists')).toBeVisible(); // this assumes your backend returns that
});
