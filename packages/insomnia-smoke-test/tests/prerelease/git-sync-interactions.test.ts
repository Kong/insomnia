import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('Clone Repo with bad values', async ({ page }) => {
  await page.click('[data-testid="project"] >> text=Insomnia');
  await page.locator('text=Create').click();
  await page.getByRole('button', { name: 'Git Clone' }).click();
  await page.getByRole('tab', { name: 'Git' }).nth(2).click();
  await page.getByPlaceholder('https://github.com/org/repo.git').fill('https://github.com/kong/dino-park-insomnia');
  await page.locator('[placeholder="Name"]').fill('test');
  await page.locator('[placeholder="Email"]').click();
  await page.locator('[placeholder="Email"]').fill('test');
  await page.locator('[placeholder="MyUser"]').click();
  await page.locator('[placeholder="MyUser"]').fill('test');
  await page.locator('[placeholder="\\38 8e7ee63b254e4b0bf047559eafe86ba9dd49507"]').click();
  await page.locator('[placeholder="\\38 8e7ee63b254e4b0bf047559eafe86ba9dd49507"]').fill('test');
  await page.locator('[placeholder="\\38 8e7ee63b254e4b0bf047559eafe86ba9dd49507"]').press('Enter');
  await page.locator('[data-testid="CodeEditor"] >> text=description').first().click();
  await page.locator('text=openapi').click();
  await page.locator('#root button:has-text("main")').click();
  await page.locator('button:has-text("History")').click();
  await page.locator('text=Git History').click();
  await page.locator('text=Done').click();
  await page.getByRole('button', { name: 'main ' }).click();
  await page.getByRole('button', { name: ' Branches' }).click();
  await page.getByPlaceholder('testing-branch').fill('test123');
  await page.getByRole('button', { name: '+ Create' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'test123 ' }).click();
  await page.getByRole('button', { name: ' Push' }).click();
  await expect(true).toBeTruthy();
});

// TODO(kreosus): more preferences will be added for secrets to be used

// TODO(kreosus): more preferences scenarios will be added in the followup iterations of increasing app test coverage
