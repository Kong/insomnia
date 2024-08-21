import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Debug-Sidebar', async () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  test.beforeEach(async ({ app, page }) => {
    const text = await loadFixture('simple.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByLabel('simple').click();
  });

  test.describe('Interact with sidebar', async () => {
    test('Open Properties in Request Sidebar', async ({ page }) => {
      const requestLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'example http' });
      await requestLocator.click();
      await requestLocator.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
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
      // Close settings modal
      await page.locator('.app').press('Escape');

      const gql = page.getByLabel('Request Collection').getByRole('row', { name: 'example graphql' });
      await gql.click();
      await gql.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
      // Close settings modal
      await page.locator('.app').press('Escape');
      const folderLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'test folder' });
      await folderLocator.click();
      await folderLocator.getByLabel('Request Group Actions').click();
      await page.getByRole('menuitemradio', { name: 'Settings' }).click();
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

    test.skip('Delete Request', async ({ page }) => {
      const requestLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'example http' });
      await requestLocator.click();
      const numberOfRequests = await page.getByLabel('Request Collection').getByRole('row').count();
      await requestLocator.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Delete' }).click();
      await page.locator('.modal__content').getByRole('button', { name: 'Delete' }).click();

      expect(page.getByLabel('Request Collection').getByRole('row')).toHaveCount(numberOfRequests - 1);
    });

    test('Rename a request', async ({ page }) => {
      const requestLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'example http' });
      await requestLocator.click();
      await requestLocator.getByLabel('Request Actions').click();
      await page.getByRole('menuitemradio', { name: 'Rename' }).click();

      await page.getByRole('textbox', { name: 'GET example http' }).fill('example http1');
      await requestLocator.click();
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

    test('Rename a request by clicking', async ({ page }) => {
      await page.getByTestId('example http').getByLabel('GET example http', { exact: true }).dblclick();
      await page.getByRole('textbox', { name: 'GET example http' }).fill('new name');
      await page.getByLabel('Request Collection').click();
      await expect(page.getByTestId('new name').getByLabel('GET new name', { exact: true })).toContainText('new name');
    });

    test('Create a new HTTP request', async ({ page }) => {
      await page.getByLabel('Create in collection').click();
      await page.getByRole('menuitemradio', { name: 'Http Request' }).click();
      await page.getByLabel('Request Collection').getByRole('row', { name: 'New Request' }).click();
    });
  });
});
