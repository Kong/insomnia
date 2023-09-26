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
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByText('Collectionsimplejust now').click();
  });

  test.describe('Interact with sidebar', async () => {
    test('Open Properties in Request Sidebar', async ({ page }) => {
      const requestLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'example http' });
      await requestLocator.click();
      await requestLocator.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.getByRole('tab', { name: 'Preview' }).click();
      // Close settings modal
      await page.locator('.app').press('Escape');

      const grpc = page.getByLabel('Request Collection').getByRole('row', { name: 'example grpc' });
      await grpc.click();
      await grpc.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      // Close settings modal
      await page.locator('.app').press('Escape');

      const ws = page.getByLabel('Request Collection').getByRole('row', { name: 'example websocket' });
      await ws.click();
      await ws.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.getByRole('tab', { name: 'Preview' }).click();
      // Close settings modal
      await page.locator('.app').press('Escape');

      const gql = page.getByLabel('Request Collection').getByRole('row', { name: 'example graphql' });
      await gql.click();
      await gql.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.getByRole('tab', { name: 'Preview' }).click();
      // Close settings modal
      await page.locator('.app').press('Escape');
      const folderLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'test folder' });
      await folderLocator.click();
      await folderLocator.getByLabel('Request Group Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.getByRole('tab', { name: 'Preview' }).click();
      // Close settings modal
      await page.locator('.app').press('Escape');
    });

    test('Open properties of the collection', async ({ page }) => {
      await page.getByLabel('Workspace actions', { exact: true }).click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      await page.getByText('Collection Settings').click();
    });

    test('Filter by request name', async ({ page }) => {
      await page.getByLabel('Request filter').click();
      await page.getByLabel('Request filter').fill('example http');
      await page.getByLabel('Request Collection').getByRole('row', { name: 'example http' }).click();
    });

    test('Filter by a folder name', async ({ page }) => {
      await page.getByLabel('Request filter').click();
      await page.getByLabel('Request filter').fill('test folder');
      await page.getByLabel('Request filter').press('Enter');
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
