import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test.describe('Dashboard', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('Can create, rename and delete new project, collection and document', async ({ page, insomnia }) => {
    await expect.soft(page.locator('.app')).not.toContainText('Git Sync');
    await expect.soft(page.locator('.app')).not.toContainText('Setup Git Sync');

    // Create new project
    await page.getByRole('button', { name: 'Create new Project' }).click();
    await page.getByText('Local Vault').click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Check empty project
    await expect.soft(page.locator('.app')).toContainText('Welcome to your project!');
    await expect.soft(page.locator('.app')).toContainText('Start fresh or bring in existing work');

    await insomnia.navigationSidebar.selectProjectDropdownOption({
      projectName: 'My Project',
      actionName: 'Settings',
    });
    await page.getByPlaceholder('My Project').click();
    await page.getByPlaceholder('My Project').fill('My Project123');
    await page.getByRole('button', { name: 'Update' }).click();

    // Check that the project name is updated on modal
    await expect.soft(page.locator('.app')).toContainText('My Project123');

    // Close project settings modal
    await page.locator('.app').press('Escape');
    await expect.soft(page.locator('.app')).toContainText('My Project123');

    // Delete project
    await insomnia.navigationSidebar.selectProjectDropdownOption({
      projectName: 'My Project123',
      actionName: 'Delete',
    });
    await page.getByRole('button', { name: 'Delete' }).click();

    // After deleting project, return to default Insomnia Dashboard
    await expect.soft(page.locator('.app')).toContainText('Personal Workspace');
    await expect.soft(page.locator('.app')).not.toContainText('My Project123');
    await expect.soft(page.locator('.app')).toContainText('Create document');
    await expect.soft(page.locator('.app')).not.toContainText('Setup Git Sync');

    // Documents
    await expect.soft(page.locator('.app')).not.toContainText('Git Sync');
    await expect.soft(page.locator('.app')).not.toContainText('Setup Git Sync');

    // Create new document
    await page.getByRole('button', { name: 'Create document', exact: true }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await page.getByTestId('workspace-breadcrumb-level-0').click();

    // Rename document
    await page.getByLabel('Files').getByLabel('My Design Document').getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await page.locator('text=Rename DocumentName Rename >> input[type="text"]').fill('test123');
    await page.getByRole('button', { name: 'Rename' }).click();
    await expect.soft(page.locator('.app')).toContainText('test123');

    // Duplicate document
    await page.getByLabel('Files').getByLabel('test123').getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await page.locator('input[name="name"]').fill('test123-duplicate');
    await page.click('[role="dialog"] button:has-text("Duplicate")');

    await page.getByTestId('workspace-breadcrumb-level-0').click();

    // Collections

    // Create new collection
    await page.getByLabel('Create in project').click();
    await page.getByText('Request collection').click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByTestId('workspace-breadcrumb-level-0').click();

    // Rename collection
    await page.click('text=CollectionMy Collectionjust now >> button');
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await page.locator('text=Rename CollectionName Rename >> input[type="text"]').fill('collection123');
    await page.getByRole('button', { name: 'Rename' }).click();
    await expect.soft(page.locator('.app')).toContainText('collection123');

    // Duplicate collection
    await page.getByLabel('Files').getByLabel('collection123').getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await page.locator('input[name="name"]').fill('collection123-duplicate');
    await page.click('[role="dialog"] button:has-text("Duplicate")');

    await page.getByTestId('workspace-breadcrumb-level-0').click();

    // Delete collection
    await page.getByLabel('Files').getByLabel('collection123-duplicate').getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
  });
});
