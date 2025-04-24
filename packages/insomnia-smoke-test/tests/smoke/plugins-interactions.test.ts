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

  // Reject plugin name with consecutive dashes
  await page.locator('text=Generate New Plugin').click();
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

  // Reject plugin name that is a single dash
  await page.getByLabel('Plugin name').fill('-');
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin name must not be a single dash')).toBeVisible();

  // Reject plugin name starting with a period
  await page.getByLabel('Plugin name').fill('.plugin');
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin name cannot start with a period')).toBeVisible();

  // Reject plugin name starting with an underscore
  await page.getByLabel('Plugin name').fill('_plugin');
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin name cannot start with an underscore')).toBeVisible();

  // Reject plugin name with leading or trailing spaces
  await page.getByLabel('Plugin name').fill(' plugin ');
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin name cannot contain leading or trailing spaces')).toBeVisible();

  // Reject plugin name with invalid characters
  await page.getByLabel('Plugin name').fill('plugin@name');
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin name must be lowercase, alphanumeric, and dash-separated')).toBeVisible();

  // Reject plugin name with path traversal characters
  await page.getByLabel('Plugin name').fill('../plugin');
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin name must not contain path traversal characters')).toBeVisible();

  await page.getByLabel('Plugin name').fill('..\\plugin');
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin name must not contain path traversal characters')).toBeVisible();

  // Reject overly long plugin names
  const longName = 'a'.repeat(256);
  await page.getByLabel('Plugin name').fill(longName);
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin name must not be empty or too long')).toBeVisible();

  // Prevent creating a plugin with a name that already exists
  const pluginName = 'duplicate-plugin';
  await page.getByLabel('Plugin name').fill(pluginName);
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.getByRole('cell', { name: `insomnia-plugin-${pluginName}` })).toBeVisible();

  // Try to generate the same plugin again
  await page.locator('text=Generate New Plugin').click();
  await page.getByLabel('Plugin name').fill(pluginName);
  await page.getByTestId('generate-plugin-button').click();
  await expect.soft(page.locator('text=Plugin already exists')).toBeVisible();
});
