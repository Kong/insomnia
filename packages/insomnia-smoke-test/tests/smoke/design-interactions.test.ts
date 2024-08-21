import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Design interactions', async () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('Unit Test interactions', async ({ app, page }) => {
    // Setup
    const text = await loadFixture('unit-test.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByText('unit-test.yaml').click();
    // Switch to Test tab
    await page.click('a:has-text("Test")');

    // Run tests and check results
    await page.getByLabel('Run all tests').click();
    await expect(page.locator('.app')).toContainText('Request A is found');
    await expect(page.locator('.app')).toContainText('Request B is not found');
    await expect(page.locator('.app')).toContainText('Tests passed');

    // Create a new test suite
    await page.click('text=New test suite');

    // Rename test suite
    await page.getByRole('heading', { name: 'New Suite' }).locator('span').dblclick();
    await page.getByRole('textbox').fill('New Suite 2');
    await page.getByRole('textbox').press('Enter');

    // Add a new test
    await page.getByLabel('New test').click();

    // Rename test
    await page.getByLabel('Unit tests').getByRole('heading', { name: 'Returns' }).locator('div').dblclick();
    await page.getByLabel('Unit tests').getByRole('textbox').fill('Returns 200 and works');
    await page.getByLabel('Unit tests').getByRole('textbox').press('Enter');
    await page.getByLabel('Unit tests').getByText('Returns 200 and works').click();
    // Use autocomplete inside the test code
    // TODO(filipe) - add this in another PR
  });
});
