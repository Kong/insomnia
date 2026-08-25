import { expect } from '@playwright/test';

import playwrightConfig from '../../playwright.config';
import { test } from '../../playwright/test';

// @ts-expect-error playwrightConfig.webServer.url must exists
const devServerUrl = playwrightConfig?.webServer?.url || 'http://127.0.0.1:4010';

test.describe('Cloud Sync', () => {
  test.beforeAll(async () => {
    await fetch(`${devServerUrl}/__test-config/cloud-sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
  });

  test.afterAll(async () => {
    await fetch(`${devServerUrl}/__test-config/cloud-sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
  });

  test('Discard, branch and commit actions', async ({ page, insomnia }) => {
    // Sync My Collection R1
    await insomnia.navigationSidebar.fetchUnsyncedWorkspace('My Collection R1');
    // The request tree loads asynchronously after the workspace is selected (a separate step from
    // the fetch/pull spinner above), and can occasionally take longer than the default 30s action
    // timeout under CI load. Wait for the row itself with extra headroom before clicking it.
    await insomnia.navigationSidebar.requestRow('New Request').waitFor({ state: 'visible', timeout: 60_000 });
    await insomnia.navigationSidebar.clickRequestOrFolder('New Request');
    // Send request and check body
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Console' }).click();
    await page.getByText('foo=bar').click();
    // Set body and discard changes
    await page.getByRole('tab', { name: 'Body' }).click();
    const bodyEditor = page.getByRole('tabpanel').getByTestId('CodeEditor').getByRole('textbox').first();
    await bodyEditor.fill('value=changed');
    await page.getByLabel('Git Sync').click();
    const discardButton = page.getByLabel('Discard all changes');
    // Wait for discard button to be enabled
    await expect.soft(discardButton).not.toHaveAttribute('aria-disabled', 'true');
    await discardButton.click({ delay: 500 });
    // Check body is reverted
    await page.getByRole('tab', { name: 'Params' }).click();
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Console' }).click();
    await page.getByText('foo=bar').click();

    // Set body and commit change
    await page.getByRole('tab', { name: 'Body' }).click();
    await page.getByRole('tabpanel').getByTestId('CodeEditor').getByRole('textbox').first().fill('value=changed');
    // Click push
    await page.getByLabel('Git Sync').click();
    await page.getByLabel('Commit').click({ delay: 500 });
    // stash changes
    await page.getByRole('row', { name: 'New Request' }).locator('[data-icon="plus"]').click();
    await page.getByRole('textbox', { name: 'Message' }).fill('Smoke test: modify request body');
    await page.getByRole('button', { name: 'Commit and push' }).click();
    await page.getByLabel('Git Sync').click();
    // expect no unpushed changes
    await expect.soft(page.getByLabel('Commit')).toHaveAttribute('aria-disabled', 'true');

    // restore commit
    const historyButton = page.getByText('History');
    // Wait for history button to be enabled
    await expect.soft(historyButton).not.toHaveAttribute('aria-disabled', 'true');
    historyButton.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).nth(2).dblclick();
    await page.getByRole('dialog').locator('[data-icon="x"]').click();
    // Ensure body is restored
    await page.getByRole('tab', { name: 'Body' }).click();
    await page.getByRole('button', { name: 'Send' }).click();
    await expect.soft(page.getByTestId('request-pane').getByText('foo=bar')).toBeHidden();

    // select unsynced MCP project to check branch actions. Sidebar is still focused on
    // "My Collection R1"; unsynced workspace rows for any other workspace are hidden while
    // focused, so back out first.
    await insomnia.navigationSidebar.backToAllProjects();
    await insomnia.navigationSidebar.fetchUnsyncedWorkspace('My MCP Client');
    await page.getByLabel('Git Sync').click();
    await page.getByText('Branches').click();

    const branchModal = page.getByRole('dialog');
    const localBranchDiv = branchModal.getByLabel('Branches list', { exact: true });
    const remoteBranchDiv = branchModal.getByLabel('Remote Branches list', { exact: true });
    await remoteBranchDiv.getByLabel('develop').getByRole('button', { name: 'Fetch' }).click();
    // validate remote branch fetched
    await expect.soft(localBranchDiv.getByLabel('develop')).toBeVisible();
    // checkout master branch
    await localBranchDiv.getByLabel('master').getByRole('button', { name: 'Checkout' }).click();
    // delete local branch
    await localBranchDiv.getByLabel('develop').getByRole('button', { name: 'Delete' }).dblclick();
    // validate local branch deleted
    await expect.soft(localBranchDiv.getByLabel('develop')).toHaveCount(0);
    // create new branch
    await branchModal.getByRole('textbox', { name: 'Branch name' }).fill('smoke-test-branch');
    await branchModal.getByRole('button', { name: 'Create' }).click();
    // validate new branch
    await expect.soft(localBranchDiv.getByLabel('smoke-test-branch')).toBeVisible();
    await expect
      .soft(localBranchDiv.getByLabel('smoke-test-branch').getByRole('button', { name: 'Delete' }))
      .toBeDisabled();
    await page.getByRole('dialog').locator('[data-icon="x"]').click();
  });

  test('Push actions', async ({ page, app, insomnia }) => {
    test.slow();

    await insomnia.navigationSidebar.fetchUnsyncedWorkspace('My Environment');
    // Wait for sync-dropdown to be mounted
    await page.getByLabel('Git Sync').waitFor({ state: 'visible' });
    await fetch(`${devServerUrl}/__test-config/cloud-sync/new-commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    await page.getByLabel('My Environment').first().click();
    await app.evaluate(({ BrowserWindow }) => {
      // Get all window and force trigger sync
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach(win => {
        win.webContents.send('mainWindowFocusChange', true);
      });
    });

    await page.getByLabel('Git Sync').click({ delay: 1000 });
    const pullButton = page.getByLabel('Pull');
    await expect.soft(pullButton).not.toHaveAttribute('aria-disabled', 'true');
    await pullButton.click();

    // Keep focus in environment tree after sync to avoid transient focus races.
    await page.getByLabel('My Environment').first().click();
    await fetch(`${devServerUrl}/__test-config/cloud-sync/new-commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
  });

  test('Check delete workspace locally and remotely', async ({ page, insomnia }) => {
    //Sync My Collection R1
    await insomnia.navigationSidebar.fetchUnsyncedWorkspace('My Collection R1');
    // go back
    await page.getByTestId('workspace-breadcrumb-level-0').click();

    // delete workspace locally
    await page.getByLabel('My Collection R1').getByTestId('DropdownButton').click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByText('Remove Local Copy').click();
    await page.getByRole('button', { name: 'Delete Workspace' }).click();
    // check workspace is deleted locally

    await expect.soft(insomnia.navigationSidebar.unsyncedWorkspaceRow('My Collection R1')).toBeVisible();
    await expect.soft(insomnia.navigationSidebar.workspaceRow('My Collection R1')).toBeHidden();
    // Sync My Collection R1 again
    await page.getByTestId('workspace-grid').getByLabel('My Collection R1').click();
    // go back
    await page.getByTestId('workspace-breadcrumb-level-0').click();

    // delete workspace both locally and remotely
    await page.getByTestId('workspace-grid').getByLabel('My Collection R1').getByTestId('DropdownButton').click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete Workspace' }).click();
    // check workspace is deleted remotely
    await expect.soft(insomnia.navigationSidebar.unsyncedWorkspaceRow('My Collection R1')).toBeHidden();
    await expect.soft(insomnia.navigationSidebar.workspaceRow('My Collection R1')).toBeHidden();
  });
});
