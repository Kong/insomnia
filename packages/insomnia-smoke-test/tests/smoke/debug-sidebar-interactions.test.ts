import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Debug-Sidebar', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('Requests', async ({ page, app }) => {
    const text = await loadFixture('simple.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByLabel('simple').click();
    //Open Properties in Request Sidebar
    const requestLocator = page.getByLabel('Request Collection').getByRole('row', { name: 'example http' });
    await page.getByLabel('Request Collection').getByRole('row', { name: 'example http' }).click();
    await page
      .getByLabel('Request Collection')
      .getByRole('row', { name: 'example http' })
      .getByLabel('Request Actions')
      .click();
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

    //Open properties of the collection
    await page.getByLabel('Workspace actions', { exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Settings' }).click();
    await page.getByText('Collection Settings').click();
    await page.getByRole('button', { name: 'Update' }).click();

    // Filter by request name
    await page.getByLabel('Request filter').click();
    await page.getByLabel('Request filter').fill('example http');
    await page.getByLabel('Request Collection').getByRole('row', { name: 'example http' }).click();

    // Filter by a folder name
    await page.getByLabel('Request filter').click();
    await page.getByLabel('Request filter').fill('test folder');
    await page.getByLabel('Request filter').press('Enter');
    await page.getByLabel('Request Collection').getByRole('row', { name: 'test folder' }).click();
    await page.getByLabel('Clear search').click();

    // Open Generate code
    await page.getByLabel('Request Collection').getByRole('row', { name: 'example http' }).click();
    await page.getByTestId('Dropdown-example-http').click();
    await page.getByRole('menuitemradio', { name: 'Generate Code' }).click();
    await page.locator('[data-testid="CodeEditor"] >> text=curl').click();
    await page.locator('text=Done').click();

    // Pin a Request
    await page.getByLabel('Request Collection').getByRole('row', { name: 'example http' }).click();
    await page
      .getByLabel('Request Collection')
      .getByRole('row', { name: 'example http' })
      .getByLabel('Request Actions')
      .click();
    await page.getByRole('menuitemradio', { name: 'Pin' }).click();
    // Click pinned request on pinned request list
    const pinnedRequestLocator = page.getByLabel('Pinned Requests').getByRole('row', { name: 'example http' });
    await pinnedRequestLocator.click();

    await page.getByLabel('Request Collection').getByRole('row', { name: 'example http' }).click();

    // Rename a request
    await page.getByLabel('Request Collection').getByRole('row', { name: 'example http' }).click();
    await page
      .getByLabel('Request Collection')
      .getByRole('row', { name: 'example http' })
      .getByLabel('Request Actions')
      .click();
    await page.getByRole('menuitemradio', { name: 'Rename' }).click();

    await page.getByRole('textbox', { name: 'GET example http' }).fill('example http1');
    await page.getByLabel('Request Collection').getByRole('row', { name: 'example http' }).click();

    // Update a request folder via settings
    await folderLocator.click();
    await folderLocator.getByLabel('Request Group Actions').click();
    await page.getByRole('menuitemradio', { name: 'Settings' }).click();
    await page.getByPlaceholder('test folder').fill('test folder1');
    await page.locator('.app').press('Escape');
    await page.getByLabel('Request Collection').getByRole('row', { name: 'test folder1' }).click();

    // Rename a request by clicking
    await page.getByTestId('example http1').getByLabel('GET example http1', { exact: true }).dblclick();

    await page.getByRole('textbox', { name: 'GET example http1' }).fill('new name');
    await page.getByLabel('Request Collection').click();
    await expect
      .soft(page.getByTestId('new name').getByLabel('GET new name', { exact: true }))
      .toContainText('new name');

    // Create a new HTTP request
    await page.getByLabel('Create in collection').click();
    await page.getByRole('menuitemradio', { name: 'Http Request' }).click();
    await page.getByLabel('Request Collection').getByRole('row', { name: 'New Request' }).click();
  });
});
