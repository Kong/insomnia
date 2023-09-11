import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('can render Spectral OpenAPI lint errors', async ({ page }) => {
  await page.getByRole('button', { name: 'New Document' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await page.click('text=Design');
  await page.click('text=start from an example');

  const codeEditor = page.locator('.pane-one');
  await expect(codeEditor).toContainText('openapi: 3.0.0');

  // Cause a lint error
  await page.locator('[data-testid="CodeEditor"] >> text=info').click();
  await page.locator('textarea').nth(1).press('Tab');
  // TODO - fix the locator so we don't rely on `.nth(1)` https://linear.app/insomnia/issue/INS-2255/revisit-codemirror-playwright-selectorfill

  await page.getByLabel('Toggle lint panel').click();
  await expect(codeEditor).toContainText('oas3-schema Object must have required property "info"');
});
