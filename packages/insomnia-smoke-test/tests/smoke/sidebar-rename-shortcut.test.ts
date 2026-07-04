import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// Coverage for the F2 rename shortcut (sidebar_renameFocusedItem): pressing F2 while a sidebar row
// holds keyboard focus switches that row into inline-edit mode. There is one test per supported
// item type — requests, folders, collections, documents, mock servers, environments and MCP clients.

// The sidebar rows are React Aria GridList rows; the node's data-testid lives inside the focusable
// [role="row"] element that carries the data-key the shortcut reads.
const focusableRow = (page: Page, nodeTestId: string): Locator =>
  page.locator(`[role="row"]:has([data-testid="${nodeTestId}"])`);

// Focus the row, press F2, then type the new name into the inline editor that appears.
const renameFocusedRow = async (page: Page, nodeTestId: string, newName: string): Promise<void> => {
  const row = focusableRow(page, nodeTestId);
  await row.waitFor({ state: 'visible' });
  await row.press('F2');
  const input = row.getByRole('textbox');
  await input.fill(newName);
  await input.press('Enter');
};

// Return to the project dashboard and create a workspace of the given type via the "Create in
// project" menu. The New Workspace modal pre-fills a default name we can predict per type.
const createWorkspaceViaMenu = async (page: Page, menuItemName: string): Promise<void> => {
  await page.getByTestId('workspace-breadcrumb-level-0').click();
  await page.getByLabel('Create in project').click();
  await page.getByRole('menuitemradio', { name: menuItemName }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
};

test.describe('F2 renames the focused sidebar item', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  // Import a collection so the sidebar already contains a request ("example http"), a folder
  // ("test folder") and a collection ("simple"), and the project dashboard shows the create toolbar.
  test.beforeEach(async ({ app, page }) => {
    const text = await loadFixture('simple.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByTestId('request-node-example http').waitFor({ state: 'visible' });
  });

  test('renames a request', async ({ page, insomnia }) => {
    await renameFocusedRow(page, 'request-node-example http', 'renamed request');
    await expect.soft(insomnia.navigationSidebar.requestRow('renamed request')).toBeVisible();
  });

  test('renames a folder', async ({ page, insomnia }) => {
    await renameFocusedRow(page, 'request-node-test folder', 'renamed folder');
    await expect.soft(insomnia.navigationSidebar.requestRow('renamed folder')).toBeVisible();
  });

  test('renames a collection', async ({ page, insomnia }) => {
    await renameFocusedRow(page, 'workspace-node-simple', 'renamed collection');
    await expect.soft(insomnia.navigationSidebar.workspaceRow('renamed collection')).toBeVisible();
  });

  test('renames a document', async ({ page, insomnia }) => {
    await createWorkspaceViaMenu(page, 'Document');
    await renameFocusedRow(page, 'workspace-node-My Design Document', 'renamed document');
    await expect.soft(insomnia.navigationSidebar.workspaceRow('renamed document')).toBeVisible();
  });

  test('renames a mock server', async ({ page, insomnia }) => {
    await createWorkspaceViaMenu(page, 'Mock Server');
    await renameFocusedRow(page, 'workspace-node-My Mock Server', 'renamed mock');
    await expect.soft(insomnia.navigationSidebar.workspaceRow('renamed mock')).toBeVisible();
  });

  test('renames an environment', async ({ page, insomnia }) => {
    await createWorkspaceViaMenu(page, 'Environment');
    await renameFocusedRow(page, 'workspace-node-My Environment', 'renamed environment');
    await expect.soft(insomnia.navigationSidebar.workspaceRow('renamed environment')).toBeVisible();
  });

  test('renames an MCP client', async ({ page, insomnia }) => {
    await createWorkspaceViaMenu(page, 'MCP Client');
    await renameFocusedRow(page, 'workspace-node-My MCP Client', 'renamed mcp');
    await expect.soft(insomnia.navigationSidebar.workspaceRow('renamed mcp')).toBeVisible();
  });
});
