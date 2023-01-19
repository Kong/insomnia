import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Dashboard', async () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  test.describe('Projects', async () => {
    test('Can create, rename and delete new project', async ({ page }) => {
      // Return to Dashboard
      await page.getByTestId('project').click();
      await expect(page.locator('.app')).toContainText('All Files (1)');
      await expect(page.locator('.app')).not.toContainText('Setup Git Sync');

      // Create new project
      await page.click('[data-testid="CreateProjectButton"]');
      await page.locator('text=Create').nth(1).click();

      // Check empty project
      await expect(page.locator('.app')).toContainText('This is an empty project, to get started create your first resource:');

      // Rename Project
      await page.click('[data-testid="ProjectDropDown-My-Project"] button');
      await page.getByRole('menuitem', { name: 'Project Settings' }).click();
      await page.getByPlaceholder('My Project').click();
      await page.getByPlaceholder('My Project').fill('My Project123');

      // Check that the project name is updated on modal
      await expect(page.locator('.app')).toContainText('My Project123');

      // Close project settings modal
      await page.locator('.app').press('Escape');
      await expect(page.locator('.app')).toContainText('My Project123');

      // Delete project
      await page.click('[data-testid="ProjectDropDown-My-Project123"] button');
      await page.getByRole('menuitem', { name: 'Project Settings' }).click();
      // Click text=NameActions Delete >> button
      await page.click('text=NameActions Delete >> button');
      await page.getByRole('button', { name: 'Click to confirm' }).click();

      // After deleting project, return to default Insomnia Dashboard
      await expect(page.locator('.app')).toContainText('Insomnia');
      await expect(page.locator('.app')).not.toContainText('My Project123');
      await expect(page.locator('.app')).toContainText('New Document');
      await expect(page.locator('.app')).toContainText('All Files (1)');
      await expect(page.locator('.app')).not.toContainText('Setup Git Sync');
    });
  });
  test.describe('Interactions', async () => { // Not sure about the name here
    test('Can filter through multiple collections', async ({ app, page }) => {
      await page.getByTestId('project').click();
      await expect(page.locator('.app')).toContainText('All Files (1)');
      await expect(page.locator('.app')).not.toContainText('Setup Git Sync');

      await page.getByRole('button', { name: 'Create' }).click();
      const text = await loadFixture('multiple-workspaces.yaml');
      await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
      await page.getByRole('menuitem', { name: 'Clipboard' }).click();

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

    test('Can create, rename and delete a document', async ({ page }) => {
      await page.getByTestId('project').click();
      await expect(page.locator('.app')).toContainText('All Files (1)');
      await expect(page.locator('.app')).not.toContainText('Setup Git Sync');

      // Create new document
      await page.getByRole('button', { name: 'Create' }).click();
      await page.getByRole('menuitem', { name: 'Design Document' }).click();
      await page.locator('text=Create').nth(1).click();

      // Return to dashboard
      await page.getByTestId('project').click();
      await expect(page.locator('.app')).toContainText('my-spec.yaml');

      // Rename document
      await page.click('text=Documentmy-spec.yamljust now >> button');
      await page.getByRole('menuitem', { name: 'Rename' }).click();
      await page.locator('text=Rename DocumentName Rename >> input[type="text"]').fill('test123');
      await page.click('#root button:has-text("Rename")');
      await expect(page.locator('.app')).toContainText('test123');

      // Duplicate document
      await page.click('text=Documenttest123just now >> button');
      await page.getByRole('menuitem', { name: 'Duplicate' }).click();
      await page.locator('input[name="name"]').fill('test123-duplicate');
      await page.click('[role="dialog"] button:has-text("Duplicate")');

      // Return to dashboard
      await page.getByTestId('project').click();
      await expect(page.locator('.app')).toContainText('test123-duplicate');

      const workspaceCards = page.locator('.card-badge');
      await expect(workspaceCards).toHaveCount(3);

      // Delete document
      await page.click('text=Documenttest123just now >> button');
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.locator('text=Yes').click();
      await expect(workspaceCards).toHaveCount(2);
    });

    test('Can create, rename and delete a collection', async ({ page }) => {
      await page.getByTestId('project').click();
      await expect(page.locator('.app')).toContainText('All Files (1)');
      await expect(page.locator('.app')).not.toContainText('Setup Git Sync');

      // Create new collection
      await page.getByRole('button', { name: 'Create' }).click();
      await page.getByRole('menuitem', { name: 'Request Collection' }).click();
      await page.locator('text=Create').nth(1).click();

      // Return to dashboard
      await page.getByTestId('project').click();
      await expect(page.locator('.app')).toContainText('My Collection');

      // Rename collection
      await page.click('text=CollectionMy Collectionjust now >> button');
      await page.getByRole('menuitem', { name: 'Rename' }).click();
      await page.locator('text=Rename CollectionName Rename >> input[type="text"]').fill('test123');
      await page.click('#root button:has-text("Rename")');
      await expect(page.locator('.app')).toContainText('test123');

      // Duplicate collection
      await page.click('text=Collectiontest123just now >> button');
      await page.getByRole('menuitem', { name: 'Duplicate' }).click();
      await page.locator('input[name="name"]').fill('test123-duplicate');
      await page.click('[role="dialog"] button:has-text("Duplicate")');

      // Return to dashboard
      await page.getByTestId('project').click();
      await expect(page.locator('.app')).toContainText('test123-duplicate');
      const workspaceCards = page.locator('.card-badge');
      await expect(workspaceCards).toHaveCount(3);

      // Delete collection
      await page.click('text=Collectiontest123just now >> button');
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.locator('text=Yes').click();
      await expect(workspaceCards).toHaveCount(2);
    });
  });
});
