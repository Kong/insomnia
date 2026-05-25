import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Environment Editor', () => {
  test('manage environment', async ({ page, app, insomnia }) => {
    const text = await loadFixture('environments.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    // Create the environment (which will become active on creation)
    // await page.getByLabel("Select an environment").click();
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    await page.getByTestId('CreateEnvironmentDropdown').click();
    await page.getByRole('menuitemradio', { name: 'Shared Environment' }).press('Enter');
    await page.getByRole('row', { name: 'New Environment' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

    await page.getByRole('option', { name: 'New Environment' }).press('Enter');
    await page.getByRole('option', { name: 'New Environment' }).press('Escape');

    // Send a request check variables defaulted to base env since new env is empty
    await insomnia.navigationSidebar.clickRequestOrFolder('New Request');
    await page.getByRole('button', { name: 'Send' }).click();

    await page.getByRole('tab', { name: 'Console' }).click();
    await page.getByText('baseenv0').click();
    await page.getByText('baseenv1').click();

    // duplicate
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    await page.getByRole('row', { name: 'ExampleA' }).getByLabel('Environment Actions').click();
    await page.getByText('Duplicate').click();
    await page.getByLabel('Environments', { exact: true }).getByText('ExampleA (Copy)').click();

    // Rename the environment
    await page.getByRole('row', { name: 'ExampleB' }).locator('[data-editable=true]').dblclick();
    await page.getByRole('row', { name: 'ExampleB' }).locator('input').fill('Gandalf');
    await page.getByRole('row', { name: 'ExampleB' }).locator('input').press('Enter');

    await page.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('option', { name: 'Gandalf' }).press('Enter');
    await page.getByRole('option', { name: 'Gandalf' }).press('Escape');

    // Send a request check variables defaulted to base env since new env is empty
    await insomnia.navigationSidebar.clickRequestOrFolder('New Request');
    // await page.waitForTimeout(60000);
    await page.getByRole('button', { name: 'Send' }).click();

    await page.getByRole('tab', { name: 'Console' }).click();
    await page.getByText('subenvB0').click();
    await page.getByText('subenvB1').click();

    // Rename the environment
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    // add a new string environment variable
    await page.locator('pre').filter({ hasText: '"exampleNumber": 2222,' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await dialog.getByTestId('CodeEditor').getByRole('textbox').fill('"testNumber":9000,');
    await dialog.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await dialog.getByTestId('CodeEditor').getByRole('textbox').fill('"testString":"Gandalf",');

    // Open request
    // Delay the click to let debounce finish
    await dialog.getByRole('button', { name: 'Close' }).click({ delay: 200 });
    await page.getByLabel('Manage collection environments').press('Escape');
    await insomnia.navigationSidebar.clickRequestOrFolder('New Request');

    //Switch to table view and edit environment
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    // switch table view
    await page.getByRole('button', { name: 'Table Edit' }).click();
    const kvTable = page.getByRole('listbox', { name: 'Environment Key Value Pair' });
    // disable row
    await page.getByRole('button', { name: 'Disable Row' }).first().click();
    let firstRow = kvTable.getByRole('option').first();
    // check row has been disabled
    await expect.soft(firstRow).toHaveCSS('opacity', '0.4');
    // delete all items
    await page.getByRole('dialog').getByRole('button', { name: 'Delete All' }).dblclick();
    // check items have been deleted
    await expect.soft(kvTable.getByRole('option').nth(2)).toBeHidden();

    firstRow = kvTable.getByRole('option').first();
    await firstRow.getByTestId('OneLineEditor').first().click();
    await page.keyboard.type('exampleString');
    await firstRow.getByTestId('OneLineEditor').nth(1).click({ delay: 200 });
    await page.keyboard.type('kvstring');
    // add one more row
    // Delay the click to let debounce finish
    await page.getByRole('button', { name: 'Add Row' }).click({ delay: 200 });
    const secondRow = kvTable.getByRole('option').nth(1);
    await secondRow.getByTestId('OneLineEditor').first().click();
    await page.keyboard.type('exampleObject');
    // change type to json
    // Delay the click to let debounce finish
    await secondRow.getByRole('button', { name: 'Type Selection' }).click({ delay: 200 });
    await page.getByRole('menuitemradio', { name: 'JSON' }).click();
    await secondRow.getByRole('button', { name: 'Edit JSON' }).click();
    // wait for modal to show
    await expect.soft(page.getByRole('dialog').getByTestId('CodeEditor')).toBeVisible();
    const bodyEditor = page.getByRole('dialog').getByTestId('CodeEditor').getByRole('textbox');
    // move cursor right and input json string
    await bodyEditor.focus();
    await bodyEditor.press('ArrowRight');
    await bodyEditor.fill('"anotherString":"kvAnotherStr","anotherNumber": 12345');
    // Delay the click to let debounce finish
    await page.getByRole('button', { name: 'Modal Submit' }).click({ delay: 200 });

    // Open request
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByLabel('Manage collection environments').press('Escape');
    await insomnia.navigationSidebar.clickRequestOrFolder('New Request');
    await page.getByRole('button', { name: 'Send' }).click();

    await page.getByRole('tab', { name: 'Console' }).click();
    // check new environment value
    await page.getByText('kvstring').click();
    await page.getByText('kvAnotherStr').click();
    await page.getByText('12345').click();
  });
});
