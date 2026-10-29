import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Examples', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('Add, open, duplicate and delete an example', async ({ page, app, insomnia }) => {
    const text = await loadFixture('simple.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

    // Add an example from the request actions menu
    await insomnia.navigationSidebar.openRequestActionsDropdown('example http');
    await page.getByRole('menuitemradio', { name: 'Add Example' }).click();

    // The example node shows up in the sidebar and opens the example editor
    const exampleNode = page.getByTestId('example-node-200 OK');
    await expect.soft(exampleNode).toBeVisible();
    await exampleNode.click();
    await expect.soft(page).toHaveURL(/\/example\/exp_/);

    // Collapse the request's examples section; the example nodes disappear until expanded again
    const exampleToggle = page.getByTestId('example-toggle-example http');
    await expect.soft(exampleToggle).toBeVisible();
    await exampleToggle.click();
    await expect.soft(page.getByTestId('example-node-200 OK')).toHaveCount(0);
    await exampleToggle.click();
    await expect.soft(page.getByTestId('example-node-200 OK')).toHaveCount(1);

    // Duplicate the example via its context menu
    await page.getByTestId('example-node-200 OK').first().click({ button: 'right' });
    await page.getByRole('menuitemradio', { name: 'Duplicate' }).click();
    await page.getByRole('dialog').locator('#prompt-input').fill('Duplicated Example');
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
    await expect.soft(page.getByTestId('example-node-Duplicated Example')).toBeVisible();
    await expect.soft(page.getByTestId('example-node-Duplicated Example')).toHaveCount(1);

    // Save the real response as a second example
    await insomnia.navigationSidebar.clickRequestOrFolder('example http');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect.soft(page.getByTestId('response-status-tag')).toContainText('200', { timeout: 30_000 });
    await page.getByTestId('button-save-as-example').click();
    await expect.soft(page.getByTestId('example-node-200 OK')).toHaveCount(2);

    // Delete one example via its context menu
    await page.getByTestId('example-node-200 OK').first().click({ button: 'right' });
    await page.getByRole('menuitemradio', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect.soft(page.getByTestId('example-node-200 OK')).toHaveCount(0);

    // Deleting the example that is currently open lands on the parent request
    // and does not warn that the example is "not found"
    await insomnia.navigationSidebar.openRequestActionsDropdown('example http');
    await page.getByRole('menuitemradio', { name: 'Add Example' }).click();
    await expect.soft(page).toHaveURL(/\/example\/exp_/);
    await page.locator('[data-testid^="example-node-"][data-selected="true"]').click({ button: 'right' });
    await page.getByRole('menuitemradio', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect.soft(page).toHaveURL(/\/debug\/request\/req_/);
    await expect.soft(page.getByText('Example not found')).toHaveCount(0);

    // Drag-to-reorder between sibling examples is not covered here: react-aria
    // uses native HTML5 drag events, which Playwright cannot synthesize with
    // mouse primitives. Verify manually: drag one example row onto another in
    // the same request and check the order persists after a reload.
  });
});
