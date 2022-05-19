import { expect } from '@playwright/test';

import { test } from '../playwright/test';

test('can render Petstore internal example and can render errors', async ({ page }) => {
  const specPreview = page.locator('.information-container');
  const codeEditor = page.locator('[data-testid="CodeEditor"]');
  const noticeTable = page.locator('text=oas3-schema Property `ta gs` is not expected to be here.');
  await page.click('text=Design');
  await page.click('text=start from an example');
  await expect(codeEditor).toContainText('3.0.0');
  await expect(specPreview).toContainText('This is a sample server Petstore server');

  // Can render errors
  await page.locator('[data-testid="CodeEditor"] >> text=tags').first().click();
  await page.locator('textarea').nth(1).press('Tab');
  await expect(noticeTable).toBeVisible();
});
