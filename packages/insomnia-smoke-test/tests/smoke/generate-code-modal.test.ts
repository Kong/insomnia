import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Generate Code Modal', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test.beforeEach(async ({ app, page }) => {
    const text = await loadFixture('smoke-test-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  });

  test('shows httpsnippet mode when no SDK is available', async ({ page }) => {
    // "sends request with pre-request script" hits /echo — mock server returns null for paths that don't start with /pets/ 
    await page.getByLabel('Request Collection').getByTestId('sends request with pre-request script').press('Enter');
    await page.getByTestId('Dropdown-sends-request-with-pre-request-script').click();
    await page.getByRole('menuitemradio', { name: 'Generate Code' }).click();

    // Stainless banner should NOT be present
    await expect.soft(page.getByAltText('Stainless')).toBeHidden();

    // httpsnippet mode shows target/client dropdowns and footer attribution
    await expect.soft(page.getByRole('button', { name: /shell/i })).toBeVisible();
    await expect.soft(page.getByRole('button', { name: /curl/i })).toBeVisible();
    await expect.soft(page.getByRole('link', { name: 'httpsnippet' })).toBeVisible();

    await page.getByRole('button', { name: 'Done' }).click();
  });

  test('shows SDK mode with Stainless branding when an SDK is available', async ({ page }) => {
    // "send JSON request" hits 127.0.0.1:4010 — mock server returns an SDK for this host
    await page.getByLabel('Request Collection').getByTestId('send JSON request').press('Enter');
    await page.getByTestId('Dropdown-send-JSON-request').click();
    await page.getByRole('menuitemradio', { name: 'Generate Code' }).click();

    // Stainless branding banner should appear
    await expect.soft(page.getByAltText('Stainless')).toBeVisible();

    // Language dropdown should be present
    await expect.soft(page.getByRole('button', { name: /typescript/i })).toBeVisible();

    // httpsnippet footer attribution should NOT be present in SDK mode
    await expect.soft(page.getByRole('link', { name: 'httpsnippet' })).not.toBeVisible();

    // SDK snippet should be rendered in the editor (typescript-specific syntax)
    await expect.soft(page.getByTestId('CodeEditor')).toContainText('const response = await client.pets.retrieve();');

    await page.getByRole('button', { name: 'Done' }).click();
  });

  test('updates the snippet when switching SDK language', async ({ page }) => {
    await page.getByLabel('Request Collection').getByTestId('send JSON request').press('Enter');
    await page.getByTestId('Dropdown-send-JSON-request').click();
    await page.getByRole('menuitemradio', { name: 'Generate Code' }).click();

    await expect.soft(page.getByAltText('Stainless')).toBeVisible();

    // Default language is typescript — switch to python
    await page.getByRole('button', { name: /typescript/i }).click();
    await page.getByRole('menuitem', { name: 'python' }).click();

    // Editor should update to the python snippet (python-specific syntax: no const/await)
    await expect.soft(page.getByTestId('CodeEditor')).toContainText('response = client.pets.retrieve()');

    await page.getByRole('button', { name: 'Done' }).click();
  });

  test('shows error message when SDK snippet generation fails', async ({ page }) => {
    // /pets/sdk-error is a magic path: the mock server returns id='sdk-error'
    // this ID causes the generateSdkSnippet function to throw an error, simulating a failure case
    await page.getByLabel('Request Collection').getByTestId('send JSON request with SDK error').press('Enter');
    await page.getByTestId('Dropdown-send-JSON-request-with-SDK-error').click();
    await page.getByRole('menuitemradio', { name: 'Generate Code' }).click();

    // Should show the error in the editor, not stay stuck on the loading placeholder
    await expect.soft(page.getByTestId('CodeEditor')).toContainText('// Error: Failed to generate SDK snippet');

    await page.getByRole('button', { name: 'Done' }).click();
  });
});
