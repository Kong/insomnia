import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can duplicate and update requests', async ({ app, page }) => {
  const text = await loadFixture('import/multiple-workspaces.yaml');

  //import the collections
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await expect.soft(page.getByLabel('Collection 1')).toBeAttached();
  await expect.soft(page.getByLabel('Collection 2')).toBeAttached();

  //open collection1, duplicate request 1
  await page.getByRole('link', { name: 'Collection 1' }).click();
  await page.getByText('GETRequest in collection').click();
  await page.getByTestId('Dropdown-Request-in-collection-1').click();
  await page.getByText('Duplicate').click();
  //name the duplicated one to be request2
  await page.getByRole('textbox', { name: 'New Name' }).click();
  await page.getByRole('textbox', { name: 'New Name' }).fill('Request2 in collection 1');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByTestId('Request2 in collection 1').getByText('Request2 in collection').click();
  //change the request type to be POST
  await page.getByRole('button', { name: 'Request Method' }).click();
  await page.getByRole('button', { name: 'POST' }).click();
  //send the request
  await page.getByRole('button', { name: 'Send' }).click();
  //verify the response status code to be 200
  await expect.soft(page.getByText('200 OK')).toBeVisible();
  //duplicate request 2
  await page.getByTestId('Request2 in collection 1').getByText('Request2 in collection').click();
  await page.getByTestId('Dropdown-Request2-in-collection-1').click();
  await page.getByText('Duplicate').click();
  //name the duplicated one to be request3
  await page.getByRole('textbox', { name: 'New Name' }).click();
  await page.getByRole('textbox', { name: 'New Name' }).fill('Request3 in collection 1');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  //change the request3 request type to be PUT
  await page.getByTestId('Request3 in collection 1').getByText('Request3 in collection').click();
  await page.getByRole('button', { name: 'Request Method' }).click();
  await page.getByRole('button', { name: 'PUT' }).click();
  //send the request
  await page.getByRole('button', { name: 'Send' }).click();
  //verify respoonse status code to be 405
  await expect.soft(page.getByText('Method Not Allowed')).toBeVisible();

  //close opened request
  await page.getByRole('row', { name: 'tab-Request3 in collection' }).getByTestId('tab-close-button').click();
  await page.getByRole('row', { name: 'tab-Request2 in collection' }).getByTestId('tab-close-button').click();

  await page.getByRole('row', { name: 'Collection 2' }).getByLabel('Workspace actions menu button').click();
  await page.getByRole('button', { name: ' Delete' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
});
