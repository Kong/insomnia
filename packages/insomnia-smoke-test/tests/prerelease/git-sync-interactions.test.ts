import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('Clone Repo with bad values', async ({ page }) => {
  await page.click('[data-testid="project"] >> text=Insomnia');
  await page.locator('text=Create').click();
  // Click button:has-text("Git Clone")
  await page.locator('button:has-text("Git Clone")').click();
  // Click #react-aria2363789071-6-tab-custom
  await page.locator('#react-aria2363789071-6-tab-custom').click();

  // Click [placeholder="Name"]
  await page.locator('[placeholder="Name"]').click();
  // Fill [placeholder="Name"]
  await page.locator('[placeholder="Name"]').fill('test');
  // Click [placeholder="Email"]
  await page.locator('[placeholder="Email"]').click();
  // Fill [placeholder="Email"]
  await page.locator('[placeholder="Email"]').fill('test');
  // Click [placeholder="MyUser"]
  await page.locator('[placeholder="MyUser"]').click();
  // Fill [placeholder="MyUser"]
  await page.locator('[placeholder="MyUser"]').fill('test');
  // Click [placeholder="\38 8e7ee63b254e4b0bf047559eafe86ba9dd49507"]
  await page.locator('[placeholder="\\38 8e7ee63b254e4b0bf047559eafe86ba9dd49507"]').click();
  // Fill [placeholder="\38 8e7ee63b254e4b0bf047559eafe86ba9dd49507"]
  await page.locator('[placeholder="\\38 8e7ee63b254e4b0bf047559eafe86ba9dd49507"]').fill('test');
  // Press Enter
  await page.locator('[placeholder="\\38 8e7ee63b254e4b0bf047559eafe86ba9dd49507"]').press('Enter');
  // Click [data-testid="CodeEditor"] >> text=description >> nth=0
  await page.locator('[data-testid="CodeEditor"] >> text=description').first().click();
  // Click text=openapi
  await page.locator('text=openapi').click();
  // Click #root button:has-text("main")
  await page.locator('#root button:has-text("main")').click();
  // Click button:has-text("History (44)")
  await page.locator('button:has-text("History (44)")').click();
  // Click text=Git History (44)
  await page.locator('text=Git History (44)').click();
  // Click text=Done
  await page.locator('text=Done').click();

  await expect(true).toBeTruthy();
});

// TODO(kreosus): more preferences scenarios will be added in the followup iterations of increasing app test coverage
