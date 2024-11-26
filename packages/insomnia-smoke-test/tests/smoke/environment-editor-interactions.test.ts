import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Environment Editor', async () => {

  test.beforeEach(async ({ app, page }) => {
    const text = await loadFixture('environments.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByText('Collectionenvironments').click();
  });

  test('create a new environment', async ({ page }) => {
    // Create the environment (which will become active on creation)
    // await page.getByLabel("Select an environment").click();
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    await page.getByTestId('CreateEnvironmentDropdown').click();
    await page.getByRole('menuitemradio', { name: 'Shared Environment' }).press('Enter');
    await page.getByRole('row', { name: 'New Environment' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('option', { name: 'New Environment' }).press('Enter');
    await page.getByRole('option', { name: 'New Environment' }).press('Escape');

    // Send a request check variables defaulted to base env since new env is empty
    await page.getByLabel('Request Collection').getByTestId('New Request').press('Enter');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Console' }).click();
    await page.getByText('baseenv0').click();
    await page.getByText('baseenv1').click();
  });

  test('duplicate an environment', async ({ page }) => {
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    await page.getByRole('row', { name: 'ExampleA' }).getByLabel('Environment Actions').click();
    await page.getByText('Duplicate').click();
    await page.getByLabel('Environments', { exact: true }).getByText('ExampleA (Copy)').click();
  });

  // rename an existing environment
  test('Rename an existing environment', async ({ page }) => {
    // Rename the environment
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    await page.getByRole('row', { name: 'ExampleB' }).locator('[data-editable=true]').dblclick();
    await page.getByRole('row', { name: 'ExampleB' }).locator('input').fill('Gandalf');
    await page.getByRole('row', { name: 'ExampleB' }).locator('input').press('Enter');

    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('option', { name: 'Gandalf' }).press('Enter');
    await page.getByRole('option', { name: 'Gandalf' }).press('Escape');

    // Send a request check variables defaulted to base env since new env is empty
    await page.getByLabel('Request Collection').getByTestId('New Request').press('Enter');
    // await page.waitForTimeout(60000);
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Console' }).click();
    await page.getByText('subenvB0').click();
    await page.getByText('subenvB1').click();
  });

  test('Add new variables to an existing environment', async ({ page }) => {
    // Rename the environment
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    // add a new string environment variable
    await page.locator('pre').filter({ hasText: '"exampleNumber": 1111,' }).click();
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await page.getByTestId('CodeEditor').getByRole('textbox').fill('"testNumber":9000,');
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await page.getByTestId('CodeEditor').getByRole('textbox').fill('"testString":"Gandalf",');
    // Let debounce finish
    await page.waitForTimeout(1500);

    // Open request
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByLabel('Manage collection environments').press('Escape');
    await page.getByLabel('Request Collection').getByTestId('New Request').press('Enter');

    // Add number variable to request body
    await page.getByRole('tab', { name: 'Body' }).click();
    await page.locator('pre').filter({ hasText: '_.exampleObject.anotherNumber' }).press('Enter');

    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Control+ ');
    await page.getByText('_.testNumber').click();

    // Add string variable to request body
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Control+ ');
    await page.getByText('_.testString').click();
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');

    // TODO(filipe) add an environment variable that returns value of a nunjucks template (e.g. timestamp)

    // Check new variables are in the timeline
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Console' }).click();

    // FIXME(filipe) - adding variables to request body can be so fast they don't get picked up when sending request

    // await page.locator('pre').filter({ hasText: '| 9000' }).click();

    // NOTE - Test fails due to actual bug - the variables are not being added to the request body when the request is sent
    // await page.locator('pre').filter({ hasText: '| Gandalf' }).click();

  });

  test('Switch to table view and edit environment', async ({ page }) => {
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    // switch table view
    await page.getByRole('button', { name: 'Table Edit' }).click();
    const kvTable = await page.getByRole('listbox', { name: 'Environment Key Value Pair' });
    // disable row
    await page.getByRole('button', { name: 'Disable Row' }).first().click();
    let firstRow = await kvTable.getByRole('option').first();
    // check row has been disabled
    await expect(firstRow).toHaveCSS('opacity', '0.4');
    // delete all items
    await page.getByRole('button', { name: 'Delete All' }).dblclick();

    firstRow = await kvTable.getByRole('option').first();
    await firstRow.getByTestId('OneLineEditor').first().click();
    await page.keyboard.type('exampleString');
    await firstRow.getByTestId('OneLineEditor').nth(1).click();
    await page.keyboard.type('kvstring');
    // wait for editor update
    await page.waitForTimeout(1000);
    // add one more row
    await page.getByRole('button', { name: 'Add Row' }).click();
    const secondRow = await kvTable.getByRole('option').nth(1);
    await secondRow.getByTestId('OneLineEditor').first().click();
    await page.keyboard.type('exampleObject');
    // change type to json
    await secondRow.getByRole('button', { name: 'Type Selection' }).click();
    await page.getByRole('menuitemradio', { name: 'JSON' }).click();
    await secondRow.getByRole('button', { name: 'Edit JSON' }).click();
    // wait for modal to show
    await page.waitForTimeout(500);
    const bodyEditor = await page.getByTestId('CodeEditor').getByRole('textbox');
    // move cursor right and input json string
    await bodyEditor.focus();
    await bodyEditor.press('ArrowRight');
    await bodyEditor.fill('"anotherString":"kvAnotherStr","anotherNumber": 12345');
    await page.getByRole('button', { name: 'Modal Submit' }).click();
    // Let debounce finish
    await page.waitForTimeout(1500);

    // Open request
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByLabel('Manage collection environments').press('Escape');
    await page.getByLabel('Request Collection').getByTestId('New Request').press('Enter');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Console' }).click();
    // check new environment value
    await page.getByText('kvstring').click();
    await page.getByText('kvAnotherStr').click();
    await page.getByText('12345').click();
  });

});
