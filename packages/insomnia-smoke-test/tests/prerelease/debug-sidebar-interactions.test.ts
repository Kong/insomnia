import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Debug-Sidebar', async () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  test.beforeEach(async ({ app, page }) => {
    await page.getByRole('button', { name: 'Create in project' }).click();
    const text = await loadFixture('simple.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByRole('menuitemradio', { name: 'Import' }).click();
    await page.getByText('Clipboard').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByText('Collectionsimplejust now').click();
  });

  test.describe('Interact with sidebar', async () => {
    test('Open Properties of an HTTP Request', async ({ page }) => {
      const requestLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'example http' });
      await requestLocator.click();
      await requestLocator.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.getByRole('tab', { name: 'Preview' }).click();
      // Close settings modal
      await page.locator('.app').press('Escape');
    });

    test('Open properties of a grpc request', async ({ page }) => {
      const requestLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'example grpc' });
      await requestLocator.click();
      await requestLocator.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      // Close settings modal
      await page.locator('.app').press('Escape');
    });

    test('Open properties of a websocket request', async ({ page }) => {
      const requestLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'example websocket' });
      await requestLocator.click();
      await requestLocator.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.getByRole('tab', { name: 'Preview' }).click();
      // Close settings modal
      await page.locator('.app').press('Escape');
    });

    test('Open properties of a graphql request', async ({ page }) => {
      const requestLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'example graphql' });
      await requestLocator.click();
      await requestLocator.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.getByRole('tab', { name: 'Preview' }).click();
      // Close settings modal
      await page.locator('.app').press('Escape');
    });

    test('Open properties of a folder', async ({ page }) => {
      const folderLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'test folder' });
      await folderLocator.click();
      await folderLocator.getByLabel('Request Group Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.getByRole('tab', { name: 'Preview' }).click();
    });

    test('Open properties of the collection', async ({ page }) => {
      await page.getByTestId('workspace-dropdown').locator('button').click();
      await page.getByRole('menuitem', { name: 'Settings' }).click();
      await page.getByText('Collection Settings').click();
    });

    test('Filter by request name', async ({ page }) => {
      await page.getByLabel('Collection filter').click();
      await page.getByLabel('Collection filter').fill('example http');
      await page.getByLabel('Request Collection').getByRole('row', { name: 'example http' }).click();
    });

    test('Filter by a folder name', async ({ page }) => {
      await page.locator('button[aria-label="Select sort order"]').click();
      await page.getByRole('option', { name: 'Folders First' }).click();
      await page.locator('[placeholder="Filter"]').click();
      await page.locator('[placeholder="Filter"]').fill('test folder');
      await page.locator('[placeholder="Filter"]').press('Enter');
      await page.getByLabel('Request Collection').getByRole('row', { name: 'test folder' }).click();
    });

    test('Open Generate code', async ({ page }) => {
      const requestLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'example http' });
      await requestLocator.click();
      await requestLocator.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Generate Code' }).click();
      await page.locator('[data-testid="CodeEditor"] >> text=curl').click();
      await page.locator('text=Done').click();
    });

    test.skip('Use Copy as Curl for a request', async ({}) => {
      // TODO: implement this in a separate ticket
    });

    test('Pin a Request', async ({ page }) => {
      const requestLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'example http' });
      await requestLocator.click();
      await requestLocator.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Pin' }).click();
      // Click pinned request on pinned request list
      const pinnedRequestLocator = page.getByLabel('Pinned Requests').getByRole('row', { name: 'example http' });
      await pinnedRequestLocator.click();

      await requestLocator.click();
    });

    test('Delete Request', async ({ page }) => {
      const requestLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'example http' });
      await requestLocator.click();
      await requestLocator.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Delete' }).click();
      await expect(page.locator('.app')).not.toContainText('example http');
    });

    test('Rename a request', async ({ page }) => {
      const requestLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'example http' });
      await requestLocator.click();
      await requestLocator.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Rename' }).click();
      await page.locator('text=Rename RequestName Rename >> input[type="text"]').fill('example http1');
      await page.locator('div[role="dialog"] button:has-text("Rename")').click();
      await page.getByLabel('Request Collection').getByRole('row', { name: 'example http1' }).click();
    });

    test('Update a request folder via settings', async ({ page }) => {
      const folderLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'test folder' });
      await folderLocator.click();
      await folderLocator.getByLabel('Request Group Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.getByPlaceholder('test folder').fill('test folder1');
      await page.locator('.app').press('Escape');
      await page.getByLabel('Request Collection').getByRole('row', { name: 'test folder1' }).click();
    });

    test('Create a new HTTP request', async ({ page }) => {
      await page.getByLabel('Create in collection').click();
      await page.getByRole('menuitemradio', { name: 'Http Request' }).click();
      await expect(page.locator('.app')).toContainText('New Request');
    });

  // TODO: more scenarios will be added in follow-up iterations of increasing test coverage
  });
});
