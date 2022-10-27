import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Dashboard', async () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  test.describe('Projects', async () => {
    test('Can create, rename and delete new project', async ({ page }) => {
      // Return to Dashboard
      await page.click('[data-testid="project"] >> text=Insomnia');

      // Open projects dropdown
      await page.click('[data-testid="project"] >> text=Insomnia');
      await page.click('button:has-text("Create new project")');
      await page.locator('text=Create').nth(1).click();

      // Check empty project
      await expect(page.locator('.app')).toContainText('This is an empty project, to get started create your first resource:');

      // Rename Project
      await page.click('[data-testid="project"] >> text=My Project');
      await page.click('button:has-text("Project Settings")');
      await page.click('[placeholder="My Project"]');
      await page.locator('[placeholder="My Project"]').fill('My Project123');

      // Close project settings modal
      await page.locator('.app').press('Escape');

      // Delete project
      await page.click('[data-testid="project"] >> text=My Project123');
      await page.click('button:has-text("Project Settings")');
      await page.click('text=Delete');
      await page.click('button:has-text("Click to confirm")');
      await page.click('button:has-text("Delete")');

      // After deleting project, return to default Insomnia Dashboard
      await expect(page.locator('[data-testid="project"]')).toContainText('Insomnia');
      await expect(page.locator('.app')).toContainText('Dashboard');
      await expect(page.locator('.app')).toContainText('New Document');
    });
  });
  test.describe('Interactions', async () => { // Not sure about the name here
    test('Can filter through multiple collections', async ({ app, page }) => {
      await page.click('[data-testid="project"]');
      await page.click('text=Create');
      const text = await loadFixture('multiple-workspaces.yaml');
      await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
      await page.click('button:has-text("Clipboard")');

      // Check that 10 new workspaces are imported besides the default one
      const workspaceCards = page.locator('.card-badge');
      await expect(workspaceCards).toHaveCount(11);
      await expect(page.locator('.app')).toContainText('New Document');
      await expect(page.locator('.app')).toContainText('collection 1');
      await expect(page.locator('.app')).toContainText('design doc 1');
      await expect(page.locator('.app')).toContainText('Swagger Petstore V3 JSON 1.0.0');
      await expect(page.locator('.app')).toContainText('Swagger Petstore V3 YAML 1.0.0');

      // Filter by collection
      const filter = page.locator('[placeholder="Filter\\.\\.\\."]');

      // Filter by word with results expected
      await filter.fill('design');
      await expect(page.locator('.card-badge')).toHaveCount(4);

      // Filter by number
      await filter.fill('3');
      await expect(page.locator('.card-badge')).toHaveCount(2);

      // Filter by word with no results expected
      await filter.fill('invalid');
      await expect(page.locator('.card-badge')).toHaveCount(0);
    });
  });
});
