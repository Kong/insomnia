import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('can render Spectral OpenAPI lint errors', async ({ page }) => {
  await page.getByRole('button', { name: 'Create document' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await page.click('text=Use example');
  await page.click('text=Pet Store');

  const codeEditor = page.locator('.pane-one').getByTestId('CodeEditor');
  await expect.soft(codeEditor).toContainText('openapi: 3.0.4');
  await page.getByText('No lint problems').click();
  // Cause a lint error
  await page.locator('[data-testid="CodeEditor"] >> text=info').click();
  page.keyboard.insertText(' !@#$%^&*(');
  await page.getByRole('option', { name: 'oas3-schema must have' }).click();
});
