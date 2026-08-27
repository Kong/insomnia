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
    await page.getByLabel('Select a Collection Environment').click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    await page.getByTestId('AddSubEnvironment').click();

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
    await page.getByLabel('Select a Collection Environment').click();
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
    await page.getByLabel('Select a Collection Environment').click();
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
    await page.getByLabel('Select a Collection Environment').click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();

    // explicitly select Gandalf so table edits target the correct sub-environment
    await page.getByLabel('Environments', { exact: true }).getByText('Gandalf').click();
    await page.getByRole('button', { name: 'Table Edit' }).click();
    const kvTable = page.getByRole('listbox', { name: 'Environment Key Value Pair' });

    // The environment update fetcher disables Close while a change is persisting (see the
    // Close click at the end of this flow). Wait on it between edits too - each row commit
    // is an async round-trip, and firing the next edit before it lands can race with it and
    // silently clobber the row (e.g. editing a still-blank row's value before its name commit
    // has round-tripped discards the name).
    const closeButton = page.getByRole('button', { name: 'Close', exact: true });
    const waitForSync = () => expect.soft(closeButton).toBeEnabled();

    // disable the first row and verify the opacity change
    await page.getByRole('button', { name: 'Disable Row' }).first().click();
    await waitForSync();
    let firstRow = kvTable.getByRole('option').first();
    await expect.soft(firstRow).toHaveCSS('opacity', '0.4');

    // delete all rows and wait for the list to clear
    await page.getByRole('dialog').getByRole('button', { name: 'Delete All' }).dblclick();
    await kvTable.getByRole('option').nth(2).waitFor({ state: 'hidden' });
    await waitForSync();

    // add first row: exampleString = kvstring
    firstRow = kvTable.getByRole('option').first();
    await firstRow.getByTestId('OneLineEditor').first().click();
    await page.keyboard.type('exampleString');

    // clicking the value cell blurs the key cell, triggering its debounce flush; wait for
    // that commit to round-trip before typing the value (see note above)
    await firstRow.getByTestId('OneLineEditor').nth(1).click();
    await waitForSync();
    await page.keyboard.type('kvstring');

    // explicitly blur the value cell (rather than letting the Add Row click do it) so its
    // commit is its own action we can wait on. Add Row also mutates the row list itself
    // (inserting the blank row) - if that click blurred the value cell too, the blur-flush
    // and the insert would be two separate writes fired by one gesture with no way to wait
    // between them, and the older one landing after the newer one silently drops the value.
    await page.keyboard.press('Tab');
    await waitForSync();

    // add second row: exampleObject (JSON type)
    await page.getByRole('button', { name: 'Add Row' }).click();
    await waitForSync();
    // A trailing blank row is always present, so merely waiting for "something" at index 1
    // to be visible can succeed before Add Row's own pair has actually rendered - typing into
    // it then lands on the still-blank row instead, which commits as a brand new row built
    // from a stale snapshot that doesn't yet include the row Add Row just created, silently
    // dropping it. Wait for the row count itself to include the new pair (row1, new pair,
    // trailing blank = 3) before interacting with it.
    await expect.soft(kvTable.getByRole('option')).toHaveCount(3);
    const secondRow = kvTable.getByRole('option').nth(1);
    await secondRow.getByTestId('OneLineEditor').first().click();
    await page.keyboard.type('exampleObject');

    // clicking Type Selection blurs the key cell, triggering its debounce flush; wait for
    // that commit before changing the type, for the same reason as above
    await secondRow.getByRole('button', { name: 'Type Selection' }).click();
    await waitForSync();
    await page.getByRole('menuitemradio', { name: 'JSON' }).click();
    await waitForSync();
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
    await waitForSync();
    await closeButton.click();
    await page.getByRole('heading', { name: 'Manage Environments' }).waitFor({ state: 'hidden' });

    // dismiss the environment picker dropdown if it appeared
    await page.locator('body').click();
    try {
      await page
        .getByRole('listbox', { name: 'Select a Collection Environment' })
        .waitFor({ state: 'hidden', timeout: 3000 });
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
    await page.getByLabel('Select a Collection Environment').click();
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
    await page.getByLabel('Select a Collection Environment').click();
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
      await page
        .getByRole('listbox', { name: 'Select a Collection Environment' })
        .waitFor({ state: 'hidden', timeout: 3000 });
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

  test('project and collection environment dropdowns open and close independently', async ({ page }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    const projectListbox = page.getByRole('listbox', { name: 'Select a Project Environment' });
    const collectionListbox = page.getByRole('listbox', { name: 'Select a Collection Environment' });

    // opening the collection dropdown does not open the project dropdown
    await page.getByLabel('Select a Collection Environment').click();
    await expect.soft(collectionListbox).toBeVisible();
    await expect.soft(projectListbox).toBeHidden();
    await page.keyboard.press('Escape');
    await expect.soft(collectionListbox).toBeHidden();

    // opening the project dropdown does not open the collection dropdown
    await page.getByLabel('Select a Project Environment').click();
    await expect.soft(projectListbox).toBeVisible();
    await expect.soft(collectionListbox).toBeHidden();
    await page.keyboard.press('Escape');
    await expect.soft(projectListbox).toBeHidden();
  });

  test('Add Project Environment creates a project environment without activating it', async ({ page, insomnia }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    // the "+" button in the project dropdown header opens the create-workspace modal
    await page.getByLabel('Select a Project Environment').click();
    await page.getByLabel('Add Project Environment').click();
    await page.getByPlaceholder('Enter a name for your Environment').fill('My New Project Env');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('dialog', { name: 'Create or update dialog' }).waitFor({ state: 'hidden' });
    await insomnia.pressEscape();

    // creating navigates into the new environment's own page; go back to the collection
    await insomnia.navigationSidebar.selectWorkspace('My first collection');

    // the new environment shows up in the project dropdown's list, but is not auto-selected
    await expect.soft(page.getByLabel('Select a Project Environment')).toContainText('No Project Environment');
    await page.getByLabel('Select a Project Environment').click();
    await expect.soft(page.getByRole('option', { name: 'My New Project Env' })).toBeVisible();
  });

  test('Add Sub Environment and Add Private Sub Environment create environments with the correct privacy', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    await page.getByLabel('Select a Collection Environment').click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();

    // create the shared sub-environment and rename it so it can be told apart from the private one
    await page.getByTestId('AddSubEnvironment').click();
    const sharedRow = page.getByRole('row', { name: 'New Environment' });
    await sharedRow.waitFor({ state: 'visible' });
    await sharedRow.locator('[data-editable=true]').dblclick();
    await sharedRow.locator('input').fill('Shared Sub Env');
    await sharedRow.locator('input').press('Enter');
    await page.getByRole('row', { name: 'Shared Sub Env' }).waitFor({ state: 'visible' });
    await expect.soft(page.getByRole('row', { name: 'Shared Sub Env' }).locator('.fa-lock')).toHaveCount(0);

    // create the private sub-environment
    await page.getByTestId('AddPrivateSubEnvironment').click();
    const privateRow = page.getByRole('row', { name: 'New Environment' });
    await privateRow.waitFor({ state: 'visible' });
    await expect.soft(privateRow.locator('.fa-lock')).toBeVisible();
  });
});
