import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// tests/smoke/aa-request-main-workflow.test.ts
/**
 * Main request workflow smoke tests
 * - success request
 * - error response handling
 * - environment variables resolution
 */

test.describe('Main request workflow', () => {
  test.slow(
    process.platform === 'darwin' || process.platform === 'win32',
    'Electron app startup is slower on local platforms',
  );
  //  test.beforeEach(async ({ page }) => {
  //   const createBtn = page.getByLabel('Create request collection');
  //   if (await createBtn.isVisible()) {
  //     await createBtn.click();
  //   }
  // });
  //   test('POST request – success response (200)', async ({ page }) => {
  //     /**
  //  * Design:
  //  * Use a public, deterministic echo endpoint to validate POST request workflow
  //  * httpbin.org/post reliably returns request metadata, including the request URL
  //  * This avoids reliance on mocked services while keeping the test stable and reproducible
  //  */
  //   const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  //   const responseBody = page.getByTestId('response-pane');
  //   const urlInput = page.getByTestId('OneLineEditor').first();

  //   await urlInput.fill('https://httpbin.org/post');

  //   await page.getByRole('button', { name: 'Request Method' }).click();
  //   await page.getByRole('menuitem', { name: 'POST' }).click();

  //   await page.getByTestId('request-pane')
  //     .getByRole('button', { name: 'Send' })
  //     .click();

  //   await expect.soft(statusTag).toHaveText(/200/);
  //   await expect.soft(responseBody).toContainText('"url": "https://httpbin.org/post"');
  // });

  // test('Request – error response handling (404)', async ({ page }) => {
  //   /**
  //     * Design:
  //     * Use a deterministic 404 endpoint to avoid flaky failures
  //     * httpbin.org/status/404 always returns 404
  //     */
  //   const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  //   const urlInput = page.getByTestId('OneLineEditor').first();

  //   await urlInput.fill('https://httpbin.org/status/404');

  //   await page.getByTestId('request-pane')
  //     .getByRole('button', { name: 'Send' })
  //     .click();

  //   await expect.soft(statusTag).toHaveText(/404/);
  // });

  test('POST request – success response (200)', async ({ page }) => {
    /**
       * Design:
       * Use a public, deterministic echo endpoint to validate POST request workflow
       * httpbin.org/post reliably returns request metadata, including the request URL
       * This avoids reliance on mocked services while keeping the test stable and reproducible
       */
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responseBody = page.getByTestId('response-pane');
    const urlInput = page.getByTestId('OneLineEditor').first();

    // Create request
    await page.getByLabel('Create request collection').click();

    // Configure request
    await urlInput.click();
    await page.keyboard.type('https://httpbin.org/post');

    await page.getByRole('button', { name: 'Request Method' }).click();
    await page.getByText('POST', { exact: true }).click();

    // Send request
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // Assertions
    await expect.soft(statusTag).toContainText('200');
    await expect.soft(responseBody).toContainText('"url": "https://httpbin.org/post"');
  });

  test('Request – error response handling (404)', async ({ page }) => {
    /**
     * Design:
     * Use a deterministic 404 endpoint to avoid flaky failures
     * httpbin.org/status/404 always returns 404
     */
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const urlInput = page.getByTestId('OneLineEditor').first();

    await page.getByLabel('Create request collection').click();

    await urlInput.click();
    await page.keyboard.type('https://httpbin.org/status/404');

    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    await expect.soft(statusTag).toContainText('404');
  });
}); 
