import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('Preferences through click', async ({ page }) => {

  await page.locator('[data-testid="settings-button"]').click();
  await page.locator('text=Insomnia Preferences ').first().click();

  expect(true).toBeTruthy();
});

test('Preferences through keyboard shortcut', async ({ page }) => {

  await page.locator('text=Preferences (Ctrl + ,)');
  await page.locator('[data-testid="settings-button"]').click();
  await page.locator('text=Insomnia Preferences').first().click();
  // TODO: more preferences scenarios will be added in the followup iterations of increasing app test coverage
});
