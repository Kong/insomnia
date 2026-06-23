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
  await page.keyboard.insertText(' !@#$%^&*(');

  // Wait for lint to run and assert error summary is visible
  const lintSummary = page.getByRole('button', { name: /error/ });
  await expect.soft(lintSummary).toBeVisible();

  // Expand the lint panel
  await page.getByTestId('lint-panel-toggle').click();
  await expect.soft(page.getByTestId('lint-panel')).toBeVisible();
  const lintEntry = page.getByText(/oas3-schema/);
  await expect.soft(lintEntry).toBeVisible();
  await lintEntry.click();
  await expect.soft(page.getByText(/Ln \d+/).first()).toBeVisible();
});
