import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Debug-Sidebar', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('Requests', async ({ page, app, insomnia }) => {
    const text = await loadFixture('simple.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    //Open Properties in Global Sidebar
    await insomnia.navigationSidebar.openRequestActionsDropdown('example http');
    await page.getByRole('menuitemradio', { name: 'Settings' }).click();
    // Close settings modal
    await page.locator('.app').press('Escape');

    await insomnia.navigationSidebar.openRequestActionsDropdown('example grpc');
    await page.getByRole('menuitemradio', { name: 'Settings' }).click();
    // Close settings modal
    await page.locator('.app').press('Escape');

    await insomnia.navigationSidebar.openRequestActionsDropdown('example websocket');
    await page.getByRole('menuitemradio', { name: 'Settings' }).click();
    // Close settings modal
    await page.locator('.app').press('Escape');

    await insomnia.navigationSidebar.openRequestActionsDropdown('example graphql');
    await page.getByRole('menuitemradio', { name: 'Settings' }).click();
    // Close settings modal
    await page.locator('.app').press('Escape');
    await insomnia.navigationSidebar.openRequestGroupActionsDropdown('test folder');
    await page.getByRole('menuitemradio', { name: 'Settings' }).click();
    // Close settings modal
    await page.locator('.app').press('Escape');

    //Open properties of the collection
    await insomnia.navigationSidebar.openWorkspaceActionsDropdown('simple');
    await page.getByRole('menuitemradio', { name: 'Settings' }).click();
    await page.getByText('Collection Settings').click();
    await page.getByRole('button', { name: 'Update' }).click();

    // Filter by request name
    await insomnia.navigationSidebar.fillFilter('example http');
    await insomnia.navigationSidebar.clickRequestOrFolder('example http');

    // Filter by a folder name
    await insomnia.navigationSidebar.fillFilter('test folder');
    await insomnia.navigationSidebar.requestRow('test folder').click({
      modifiers: ['ControlOrMeta'],
    });
    // Wait for tab appear
    await page.getByLabel('Insomnia Tabs').getByLabel('tab-test folder', { exact: true }).click();
    await insomnia.navigationSidebar.clearFilter();

    // Open Generate code

    await insomnia.navigationSidebar.openRequestActionsDropdown('example http');
    await page.getByRole('menuitemradio', { name: 'Generate Code' }).click();
    await page.locator('[data-testid="CodeEditor"] >> text=curl').click();
    await page.locator('text=Done').click();

    // Pin a Request
    await insomnia.navigationSidebar.pinRequest('example http');
    // Click pinned request on pinned request list
    await expect.soft(insomnia.navigationSidebar.pinnedRequestRow('example http')).toBeVisible();

    // Rename a request
    await insomnia.navigationSidebar.openRequestActionsDropdown('example http');
    await page.getByRole('menuitemradio', { name: 'Rename' }).click();
    await page.getByRole('dialog').locator('#prompt-input').fill('example http1');
    await page.getByRole('dialog').getByRole('button', { name: 'Rename' }).click();
    await insomnia.navigationSidebar.requestRow('example http1').click();

    // Update a request folder via settings
    await insomnia.navigationSidebar.openRequestGroupActionsDropdown('test folder');
    await page.getByRole('menuitemradio', { name: 'Settings' }).click();
    await page.getByPlaceholder('test folder').fill('test folder1');
    await page.locator('.app').press('Escape');
    await insomnia.navigationSidebar.clickRequestOrFolder('test folder1');

    // Rename a request
    await insomnia.navigationSidebar.renameRequestOrFolder('example http1', 'new name');
    await expect.soft(insomnia.navigationSidebar.requestRow('new name')).toContainText('new name');

    // Create a new HTTP request to have two "New Request"
    await insomnia.navigationSidebar.openWorkspaceActionsDropdown('simple');
    await page.getByRole('menuitemradio', { name: 'Http Request' }).click();

    // Verify there are two "New Request" rows
    const newRequests = insomnia.navigationSidebar.requestRow('New Request');
    await expect.soft(newRequests).toHaveCount(2);
  });
});
