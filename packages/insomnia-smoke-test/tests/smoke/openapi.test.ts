import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('can render Spectral OpenAPI lint errors', async ({ page }) => {
  await page.click('text=Design');
  await page.click('text=start from an example');

  const codeEditor = page.locator('.pane-one');
  await expect(codeEditor).toContainText('openapi: 3.0.0');
  const specPreview = page.locator('.information-container');
  await expect(specPreview).toContainText('This is a sample server Petstore server');

  // Cause a lint error
  await page.locator('[data-testid="CodeEditor"] >> text=info').click();
  await page.locator('textarea').nth(1).press('Tab');

  await expect(codeEditor).toContainText('oas3-schema Object must have required property "info"');
});
