import { expect } from '@playwright/test';

import playwrightConfig from '../../playwright.config';
import { test } from '../../playwright/test';

// @ts-expect-error playwrightConfig.webServer.url must exists
const devServerUrl = playwrightConfig?.webServer?.url || 'http://127.0.0.1:4010';
const collectionProjectId = 'proj_5145140e072d4007a30bfa6630ddae70';

const postJson = async (pathname: string, body: Record<string, unknown>) => {
  const response = await fetch(`${devServerUrl}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${pathname}: ${response.status}`);
  }
};

const setStorageRule = async (rule: Partial<{
  enableCloudSync: boolean;
  enableGitSync: boolean;
  enableLocalVault: boolean;
  isOverridden: boolean;
}>) => {
  await postJson('/v1/test-utils/organizations/storage-rule', {
    enableCloudSync: true,
    enableGitSync: true,
    enableLocalVault: true,
    isOverridden: false,
    ...rule,
  });
};

const getSnapshotCount = async (projectId: string) => {
  const response = await fetch(`${devServerUrl}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `
        query ($projectId: ID!) {
          snapshots(projectId: $projectId) {
            id
          }
        }
      `,
      variables: {
        projectId,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch snapshots for ${projectId}: ${response.status}`);
  }

  const json = await response.json();
  return json.data.snapshots.length as number;
};

test.describe('Cloud Sync', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await postJson('/__test-config/cloud-sync', { enabled: true });
    await setStorageRule({ enableCloudSync: true });
  });

  test.beforeEach(async () => {
    await setStorageRule({ enableCloudSync: true });
  });

  test.afterAll(async () => {
    await postJson('/__test-config/cloud-sync', { enabled: false });
  });

  test('Discard, branch and commit actions', async ({ page }) => {
    // Sync collection project
    await page.getByLabel('Collection Project').click();
    await page.getByLabel('Request Collection').getByTestId('New Request').click();
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
    await expect.soft(page.getByTestId('response-pane').getByText('foo=bar')).toBeHidden();

    // go back and select mcp project
    await page
      .locator('[data-icon="chevron-left"]')
      .filter({ has: page.locator(':visible') })
      .first()
      .click();
    // select MCP project to check branch actions
    await page.getByLabel('MCP Project').click();
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

  test('Push actions', async ({ page, app }) => {
    await page.getByLabel('Environment Project').click();
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
    await page.getByLabel('Pull').click();
    // ensure value has been updated
    await page.getByText('foo').click();
    await page.getByText('bar').click();
    await fetch(`${devServerUrl}/__test-config/cloud-sync/new-commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
  });

  test('Create workspace initializes sync for remote projects', async ({ page }) => {
    const initialSnapshotCount = await getSnapshotCount(collectionProjectId);

    await page.getByLabel('Collection Project').click();
    await page.getByLabel('Create in project').click();
    await page.getByText('Request collection').click();
    await page.getByPlaceholder('Enter a name for your Request Collection').fill('Cloud Init Workspace');
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

    await expect.soft(page.getByTestId('workspace-context-dropdown')).toContainText('Cloud Init Workspace');
    await expect.poll(async () => (await getSnapshotCount(collectionProjectId)) > initialSnapshotCount).toBe(true);
  });

  test('Importing into a remote project initializes and pushes sync state', async ({ page, insomnia }) => {
    const initialSnapshotCount = await getSnapshotCount(collectionProjectId);

    await page.getByLabel('Collection Project').click();
    await insomnia.projectPage.importFixture('simple.yaml');

    await expect.soft(page.getByTestId('workspace-context-dropdown')).toContainText('simple');
    await expect.poll(async () => (await getSnapshotCount(collectionProjectId)) > initialSnapshotCount).toBe(true);
  });

  test('Check delete workspace locally and remotely', async ({ page }) => {
    //Sync collection project
    await page.getByLabel('Collection Project').click();
    // go back
    await page
      .locator('[data-icon="chevron-left"]')
      .filter({ has: page.locator(':visible') })
      .first()
      .click();
    // delete workspace locally
    await page.getByLabel('My Collection R1').getByTestId('DropdownButton').click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByText('Remove Local Copy').click();
    await page.getByRole('button', { name: 'Delete Workspace' }).click();
    // check workspace is deleted locally
    await expect.soft(page.getByLabel('Collection Project')).toBeVisible();
    await expect.soft(page.getByLabel('My Collection R1')).toBeHidden();
    // Sync collection project again
    await page.getByLabel('Collection Project').click();
    // go back
    await page
      .locator('[data-icon="chevron-left"]')
      .filter({ has: page.locator(':visible') })
      .first()
      .click();
    // delete workspace both locally and remotely
    await page.getByLabel('My Collection R1').getByTestId('DropdownButton').click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete Workspace' }).click();
    // check workspace is deleted remotely
    await expect.soft(page.getByLabel('Collection Project')).toBeHidden();
  });
});
