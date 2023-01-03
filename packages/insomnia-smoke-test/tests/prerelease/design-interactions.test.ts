import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Design interactions', async () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  test.fixme('Requests are auto-generated when switching tabs', async ({ page }) => {
    // TODO(filipe) - this is currently not working
    await page.click('[data-testid="project"] >> text=Insomnia');
    await expect(true).toBeTruthy();
  });

  test('Can import an OpenAPI 3 spec into a Design Document', async ({ app, page }) => {
    // Setup
    await page.click('[data-testid="project"] >> text=Insomnia');
    await page.click('text=Create');
    const text = await loadFixture('openapi3.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.click('button:has-text("Clipboard")');
    await page.click('div[role="dialog"] >> text=Design Document');
    await page.click('text=DocumentSmoke Test API server 1.0.0v1.0.0OpenAPI 3.0.0just now');

    // Renders the spec code
    const codeEditor = page.locator('.pane-one');
    await expect(codeEditor).toContainText('openapi: 3.0.0');

    // Created requests from spec
    await page.locator('text=Debug').click();
    await expect(page.locator('.app')).toContainText('File');
    await expect(page.locator('.app')).toContainText('Misc');
    await expect(page.locator('.app')).toContainText('Auth');

    // Created Environment from spec
    await page.click('#wrapper button:has-text("OpenAPI env")');
    await page.click('button:has-text("Manage Environments")');
    await page.click('text=/.*"localhost:4010".*/');
  });

  test.fixme('Can filter values in Design sidebar', async ({ page }) => {
    // TODO(filipe) implement in another PR
    await page.click('[data-testid="project"] >> text=Insomnia');
    await expect(true).toBeTruthy();
  });

  test.fixme('[INS-567] Requests are not duplicated when switching between tabs', async ({ page }) => {
    // TODO(filipe) implement in another PR
    await page.click('[data-testid="project"] >> text=Insomnia');
    await expect(true).toBeTruthy();
  });

  test('Unit Test interactions', async ({ app, page }) => {
    // Setup
    await page.click('[data-testid="project"] >> text=Insomnia');
    await page.click('text=Create');
    const text = await loadFixture('unit-test.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.click('button:has-text("Clipboard")');
    await page.click('text=unit-test.yamljust now');

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
    await page.locator('select[name="request"]').selectOption('req_17ca8bbd46374144a089f891e32842d6');

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
