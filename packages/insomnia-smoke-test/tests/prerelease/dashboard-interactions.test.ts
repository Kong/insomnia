import { expect } from '@playwright/test';

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
});
