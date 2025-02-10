import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Dashboard', async () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  test.describe('Projects', async () => {
    test('Can create, rename and delete new project', async ({ page }) => {
      await page.getByLabel('All Files (0)').click();
      await expect(page.locator('.app')).not.toContainText('Git Sync');
      await expect(page.locator('.app')).not.toContainText('Setup Git Sync');

      // Create new project
      await page.getByRole('button', { name: 'Create new Project' }).click();
      await page.getByRole('button', { name: 'Create', exact: true }).click();

      // Check empty project
      await expect(page.locator('.app')).toContainText('This is an empty project, to get started create your first resource:');

      // Rename Project
      await page.getByRole('row', { name: 'My Project' }).focus();
      await page.getByRole('row', { name: 'My Project' }).getByRole('button', { name: 'Project Actions' }).click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.getByPlaceholder('My Project').click();
      await page.getByPlaceholder('My Project').fill('My Project123');
      await page.getByRole('button', { name: 'Update' }).click();

      // Check that the project name is updated on modal
      await expect(page.locator('.app')).toContainText('My Project123');

      // Close project settings modal
      await page.locator('.app').press('Escape');
      await expect(page.locator('.app')).toContainText('My Project123');

      // Delete project
      await page.getByRole('row', { name: 'My Project' }).focus();
      await page.getByRole('row', { name: 'My Project' }).getByRole('button', { name: 'Project Actions' }).click();
      await page.getByRole('menuitemradio', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete' }).click();

      // After deleting project, return to default Insomnia Dashboard
      await expect(page.locator('.app')).toContainText('Personal Workspace');
      await expect(page.locator('.app')).not.toContainText('My Project123');
      await expect(page.locator('.app')).toContainText('New Document');
      await page.getByLabel('All Files (0)').click();
      await expect(page.locator('.app')).not.toContainText('Setup Git Sync');
    });
  });
  test.describe('Interactions', async () => { // Not sure about the name here
    // TODO(INS-2504) - we don't support importing multiple collections at this time
    test.skip('Can filter through multiple collections', async ({ app, page }) => {
      await page.getByLabel('All Files (0)').click();
      await expect(page.locator('.app')).not.toContainText('Git Sync');
      await expect(page.locator('.app')).not.toContainText('Setup Git Sync');

      const text = await loadFixture('multiple-workspaces.yaml');
      await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
      await page.getByLabel('Import').click();
      await page.locator('[data-test-id="import-from-clipboard"]').click();
      await page.getByRole('button', { name: 'Scan' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
      await page.getByLabel('Smoke tests').click();
      // Check that 10 new workspaces are imported besides the default one
      const workspaceCards = page.getByLabel('Workspaces').getByRole('gridcell');
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
      await page.getByLabel('All Files (0)').click();
      await expect(page.locator('.app')).not.toContainText('Git Sync');
      await expect(page.locator('.app')).not.toContainText('Setup Git Sync');

      // Create new document
      await page.getByRole('button', { name: 'Create in project' }).click();
      await page.getByRole('menuitemradio', { name: 'Design Document' }).click();
      await page.getByRole('button', { name: 'Create', exact: true }).click();

      await page.getByTestId('project').click();

      // Rename document
      await page.getByLabel('Files').getByLabel('my-spec.yaml').getByRole('button').click();
      await page.getByRole('menuitem', { name: 'Rename' }).click();
      await page.locator('text=Rename DocumentName Rename >> input[type="text"]').fill('test123');
      await page.click('#root button:has-text("Rename")');
      await expect(page.locator('.app')).toContainText('test123');

      // Duplicate document
      await page.getByLabel('Files').getByLabel('test123').getByRole('button').click();
      await page.getByRole('menuitem', { name: 'Duplicate' }).click();
      await page.locator('input[name="name"]').fill('test123-duplicate');
      await page.click('[role="dialog"] button:has-text("Duplicate")');

      await page.getByTestId('project').click();

      // Delete document
      await page.getByLabel('Files').getByLabel('test123-duplicate').getByRole('button').click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
      // @TODO: Re-enable - Requires mocking VCS operations
      // await expect(workspaceCards).toHaveCount(1);
    });

    test('Can create, rename and delete a collection', async ({ page }) => {
      await page.getByLabel('All Files (0)').click();
      await expect(page.locator('.app')).not.toContainText('Git Sync');
      await expect(page.locator('.app')).not.toContainText('Setup Git Sync');

      // Create new collection
      await page.getByRole('button', { name: 'Create in project' }).click();
      await page.getByRole('menuitemradio', { name: 'Request Collection' }).click();
      await page.getByRole('button', { name: 'Create', exact: true }).click();

      await page.getByTestId('project').click();

      // Rename collection
      await page.click('text=CollectionMy Collectionjust now >> button');
      await page.getByRole('menuitem', { name: 'Rename' }).click();
      await page.locator('text=Rename CollectionName Rename >> input[type="text"]').fill('test123');
      await page.click('#root button:has-text("Rename")');
      await expect(page.locator('.app')).toContainText('test123');

      // Duplicate collection
      await page.getByLabel('Files').getByLabel('test123').getByRole('button').click();
      await page.getByRole('menuitem', { name: 'Duplicate' }).click();
      await page.locator('input[name="name"]').fill('test123-duplicate');
      await page.click('[role="dialog"] button:has-text("Duplicate")');

      await page.getByTestId('project').click();

      // Delete collection
      await page.getByLabel('Files').getByLabel('test123-duplicate').getByRole('button').click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
      // @TODO: Re-enable - Requires mocking VCS operations
      // await expect(workspaceCards).toHaveCount(1);
    });
  });
});
