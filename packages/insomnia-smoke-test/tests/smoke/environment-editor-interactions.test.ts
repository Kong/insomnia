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

    // wait for import dialog to close before proceeding
    await page.getByRole('dialog').waitFor({ state: 'hidden' });

    // create a new shared environment (becomes active on creation)
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    await page.getByTestId('CreateEnvironmentDropdown').click();
    await page.getByRole('menuitemradio', { name: 'Shared Environment' }).press('Enter');

    // wait for the new row to appear before clicking it
    await page.getByRole('row', { name: 'New Environment' }).waitFor({ state: 'visible' });
    await page.getByRole('row', { name: 'New Environment' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    
    // wait for the Manage Environments dialog to close before interacting with the picker
    await page.getByRole('heading', { name: 'Manage Environments' }).waitFor({ state: 'hidden' });

    // select the new environment then dismiss the picker
    await page.getByRole('option', { name: 'New Environment' }).press('Enter');
    await page.getByRole('option', { name: 'New Environment' }).press('Escape');

    // send request: verify variables fall back to base env (new env is empty)
    await insomnia.navigationSidebar.clickRequestOrFolder('New Request');
    await page.getByRole('button', { name: 'Send' }).click();
    
    // wait for a response before switching to console
    await page.locator('[data-testid="response-status-tag"]:visible').waitFor({ state: 'visible', timeout: 25_000 });
    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.getByText('baseenv0')).toBeVisible();
    await expect.soft(page.getByText('baseenv1')).toBeVisible();

    // duplicate ExampleA and rename the copy to Gandalf
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    await page.getByRole('row', { name: 'ExampleA' }).getByLabel('Environment Actions').click();
    await page.getByText('Duplicate').click();

    // wait for the duplicated row to appear before clicking it
    await page.getByLabel('Environments', { exact: true }).getByText('ExampleA (Copy)').waitFor({ state: 'visible' });
    await page.getByLabel('Environments', { exact: true }).getByText('ExampleA (Copy)').click();

    // rename ExampleB to Gandalf
    await page.getByRole('row', { name: 'ExampleB' }).locator('[data-editable=true]').dblclick();
    await page.getByRole('row', { name: 'ExampleB' }).locator('input').fill('Gandalf');
    await page.getByRole('row', { name: 'ExampleB' }).locator('input').press('Enter');

    // wait for the row to reflect the new name before closing
    await page.getByRole('row', { name: 'Gandalf' }).waitFor({ state: 'visible' });

    await page.getByRole('button', { name: 'Close', exact: true }).click();

    // wait for the Manage Environments dialog to close before interacting with the picker
    await page.getByRole('heading', { name: 'Manage Environments' }).waitFor({ state: 'hidden' });

    // select Gandalf then dismiss the picker
    await page.getByRole('option', { name: 'Gandalf' }).press('Enter');
    await page.getByRole('option', { name: 'Gandalf' }).press('Escape');

    // send request: verify Gandalf sub-env variables are active
    await insomnia.navigationSidebar.clickRequestOrFolder('New Request');
    await page.getByRole('button', { name: 'Send' }).click();

    // wait for a response before switching to console
    await page.locator('[data-testid="response-status-tag"]:visible').waitFor({ state: 'visible', timeout: 25_000 });
    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.getByText('subenvB0')).toBeVisible();
    await expect.soft(page.getByText('subenvB1')).toBeVisible();

    // add new variables to Gandalf via JSON editor
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    await page.locator('pre').filter({ hasText: '"exampleNumber": 2222,' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await dialog.getByTestId('CodeEditor').getByRole('textbox').fill('"testNumber":9000,');
    await dialog.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await dialog.getByTestId('CodeEditor').getByRole('textbox').fill('"testString":"Gandalf",');

    // blur the editor before closing so the debounce flush is triggered by the button's mousedown
    await dialog.getByRole('button', { name: 'Close' }).click();
    
    // wait for the Manage Environments dialog to fully close before navigating
    await page.getByRole('heading', { name: 'Manage Environments' }).waitFor({ state: 'hidden' });
    await page.getByLabel('Manage collection environments').press('Escape');

    await insomnia.navigationSidebar.clickRequestOrFolder('New Request');

    // switch to table view and edit Gandalf environment
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();

    // explicitly select Gandalf so table edits target the correct sub-environment
    await page.getByLabel('Environments', { exact: true }).getByText('Gandalf').click();
    await page.getByRole('button', { name: 'Table Edit' }).click();
    const kvTable = page.getByRole('listbox', { name: 'Environment Key Value Pair' });

    // disable the first row and verify the opacity change
    await page.getByRole('button', { name: 'Disable Row' }).first().click();
    let firstRow = kvTable.getByRole('option').first();
    await expect.soft(firstRow).toHaveCSS('opacity', '0.4');

    // delete all rows and wait for the list to clear
    await page.getByRole('dialog').getByRole('button', { name: 'Delete All' }).dblclick();
    await kvTable.getByRole('option').nth(2).waitFor({ state: 'hidden' });

    // add first row: exampleString = kvstring
    firstRow = kvTable.getByRole('option').first();
    await firstRow.getByTestId('OneLineEditor').first().click();
    await page.keyboard.type('exampleString');

    // clicking the value cell blurs the key cell, triggering its debounce flush
    await firstRow.getByTestId('OneLineEditor').nth(1).click();
    await page.keyboard.type('kvstring');

    // add second row: exampleObject (JSON type)
    // clicking Add Row blurs the value cell; wait for the new row before interacting
    await page.getByRole('button', { name: 'Add Row' }).click();
    const secondRow = kvTable.getByRole('option').nth(1);
    await secondRow.waitFor({ state: 'visible' });
    await secondRow.getByTestId('OneLineEditor').first().click();
    await page.keyboard.type('exampleObject');

    // clicking Type Selection blurs the key cell, triggering its debounce flush
    await secondRow.getByRole('button', { name: 'Type Selection' }).click();
    await page.getByRole('menuitemradio', { name: 'JSON' }).click();
    await secondRow.getByRole('button', { name: 'Edit JSON' }).click();
    
    // wait for the JSON modal before typing
    await page.getByRole('dialog').getByTestId('CodeEditor').waitFor({ state: 'visible' });
    const bodyEditor = page.getByRole('dialog').getByTestId('CodeEditor').getByRole('textbox');
    await bodyEditor.focus();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('{"anotherString":"kvAnotherStr","anotherNumber": 12345}');
    
    // submit and wait for the JSON modal to fully close before proceeding
    await page.getByRole('button', { name: 'Modal Submit' }).click();
    await page.getByRole('dialog', { name: 'Modal' }).waitFor({ state: 'hidden' });

    // wait for the environment update fetcher to finish (Close is disabled while it's in-flight)
    const closeButton = page.getByRole('button', { name: 'Close', exact: true });
    await expect.soft(closeButton).toBeEnabled();
    await closeButton.click();
    await page.getByRole('heading', { name: 'Manage Environments' }).waitFor({ state: 'hidden' });

    // dismiss the environment picker dropdown if it appeared
    await page.locator('body').click();
    try {
      await page.getByRole('listbox', { name: 'Select a Collection Environment' }).waitFor({ state: 'hidden', timeout: 3000 });
    } catch {
      await page.keyboard.press('Escape');
    }

    // send request and verify the new table-edited environment values
    await insomnia.navigationSidebar.clickRequestOrFolder('New Request');
    await page.getByRole('button', { name: 'Send' }).click();

    // wait for a response before switching to console
    await page.locator('[data-testid="response-status-tag"]:visible').waitFor({ state: 'visible', timeout: 25_000 });
    await page.getByRole('tab', { name: 'Console' }).click();
    await page.getByText('kvstring').waitFor({ state: 'visible', timeout: 10_000 });
    await expect.soft(page.getByText('kvstring')).toBeVisible({ timeout: 10_000 });
    await page.getByText('kvstring').click();
    await page.getByText('kvAnotherStr').click();
    await page.getByText('12345').click();
  });

  test('disabled environment variable falls back to base environment', async ({ page, app, insomnia }) => {
    const text = await loadFixture('environments.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    // wait for import dialog to close before proceeding
    await page.getByRole('dialog').waitFor({ state: 'hidden' });

    // activate ExampleA environment
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('option', { name: 'ExampleA' }).press('Enter');
    await page.getByRole('option', { name: 'ExampleA' }).press('Escape');

    // send request: verify ExampleA overrides are active
    await insomnia.navigationSidebar.clickRequestOrFolder('New Request');
    await page.getByRole('button', { name: 'Send' }).click();
    // wait for a response before switching to console
    await page.locator('[data-testid="response-status-tag"]:visible').waitFor({ state: 'visible', timeout: 25_000 });
    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.getByText('subenvA0')).toBeVisible();

    // open env editor, select ExampleA, switch to table view, disable exampleString
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    await page.getByLabel('Environments', { exact: true }).getByText('ExampleA').click();
    await page.getByRole('button', { name: 'Table Edit' }).click();
    const kvTable = page.getByRole('listbox', { name: 'Environment Key Value Pair' });
    const exampleStringRow = kvTable.getByRole('option').filter({ hasText: 'exampleString' });
    await exampleStringRow.getByRole('button', { name: 'Disable Row' }).click();
    await expect.soft(exampleStringRow).toHaveCSS('opacity', '0.4');

    // close the editor and wait for it to fully disappear
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('heading', { name: 'Manage Environments' }).waitFor({ state: 'hidden' });

    // dismiss the environment picker dropdown if it appeared
    await page.locator('body').click();
    try {
      await page.getByRole('listbox', { name: 'Select a Collection Environment' }).waitFor({ state: 'hidden', timeout: 3000 });
    } catch {
      await page.keyboard.press('Escape');
    }

    // send request: disabled sub-env variable should fall back to base environment
    await insomnia.navigationSidebar.clickRequestOrFolder('New Request');
    await page.getByRole('button', { name: 'Send' }).click();

    // wait for a response before switching to console
    await page.locator('[data-testid="response-status-tag"]:visible').waitFor({ state: 'visible', timeout: 25_000 });
    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.getByText('baseenv0')).toBeVisible();
    await expect.soft(page.getByText('subenvA0')).toBeHidden();
  });
});
