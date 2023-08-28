import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Design interactions', async () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('Unit Test interactions', async ({ app, page }) => {
    // Setup
    await page.getByRole('button', { name: 'Create in project' }).click();
    const text = await loadFixture('unit-test.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByRole('menuitemradio', { name: 'Import' }).click();
    await page.getByText('Clipboard').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByText('unit-test.yaml').click();
    // Switch to Test tab
    await page.click('a:has-text("Test")');

    // Run tests and check results
    await page.click('#wrapper >> text=Run Tests');
    await expect(page.locator('.app')).toContainText('Request A is found');
    await expect(page.locator('.app')).toContainText('Request B is not found');
    await expect(page.locator('.app')).toContainText('Tests Passed 2/2');

    // Create a new test suite
    await page.click('text=New Test Suite');
    await page.click('text=Create Suite');
    await page.click('button:has-text("New Suite")');

    // Add a new test
    await page.locator('text=New Test').nth(1).click();
    await page.click('div[role="dialog"] button:has-text("New Test")');
    const label = await page.locator('option', { hasText: 'Request A' }).textContent() || '';
    await page.locator('select[name="request"]').selectOption({
      label,
    });

    await page.click('#wrapper >> text=Run Tests');
    await expect(page.locator('.app')).toContainText('Tests Passed 1/1');

    // Rename a test
    // TODO(filipe) - add this in another PR

    // Rename a test suite
    await page.click('button:has-text("Existing Test Suite")');
    await page.click('span:has-text("Existing Test Suite")');
    await page.locator('text=New TestRun Tests >> input[type="text"]').fill('Renamed');
    await page.locator('text=New TestRun Tests >> input[type="text"]').press('Enter');
    await page.click('button:has-text("Renamed")');

    // Use autocomplete inside the test code
    // TODO(filipe) - add this in another PR
  });
});
