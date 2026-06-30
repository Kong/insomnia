import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// Regression coverage for the focus / keyboard-navigation rules:
// - creating a request focuses the URL bar
// - adding a param/header focuses the new row's Name cell
// - opening the KV environment editor focuses the trailing blank row's Name
// - create/rename/settings dialogs focus the Name field
// - the navigation sidebar expands/collapses folders with Left/Right arrows
// - Cmd/Ctrl-N adds the new request inside the selected folder
//
// CodeMirror-backed editors (OneLineEditor) expose focus via `data-focused="on"` on their
// `.editor__container`, which is what these tests assert against.

const focusedEditorWithChild = (childIdPrefix: string) =>
  `.editor__container:has([id^="${childIdPrefix}"]) .CodeMirror-focused`;

test.describe('Focus and keyboard navigation', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('creating a request focuses the URL bar', async ({ page, insomnia }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    // Create a fresh HTTP request (this goes through the create -> redirect path that focuses the URL).
    await insomnia.navigationSidebar.openWorkspaceActionsDropdown('My first collection');
    await page.getByRole('menuitemradio', { name: 'Http Request' }).click();

    // The URL bar should be focused so the user can start typing immediately.
    await expect.soft(page.locator(focusedEditorWithChild('request-url-bar'))).toHaveCount(1);
  });

  test('adding a query parameter focuses the Name cell', async ({ page }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    await page.getByRole('tab', { name: 'Params' }).click();
    await page.getByTestId('request-pane').getByRole('button', { name: 'Add', exact: true }).click();

    await expect.soft(page.locator(focusedEditorWithChild('key-value-editor__name'))).toHaveCount(1);
  });

  test('adding a header focuses the Name cell', async ({ page }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    await page.getByRole('tab', { name: 'Headers' }).click();
    await page.getByTestId('request-pane').getByRole('button', { name: 'Add', exact: true }).click();

    await expect.soft(page.locator(focusedEditorWithChild('key-value-editor__name'))).toHaveCount(1);
  });

  test('the KV environment editor focuses the blank row Name', async ({ page }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    await page.getByTestId('CreateEnvironmentDropdown').click();
    await page.getByRole('menuitemradio', { name: 'Shared Environment' }).press('Enter');

    // New environments default to KV mode, so selecting the new (empty) environment renders the KV
    // editor whose trailing blank row's Name should be focused.
    const newEnvironmentRow = page.getByRole('row', { name: 'New Environment' });
    await newEnvironmentRow.waitFor({ state: 'visible' });
    // Click the painted name cell rather than the row's center: the row's flexible middle leaves a
    // gap that the modal's pane container reports as intercepting the click, and the blank-row
    // autofocus churns focus/scroll right after the editor mounts.
    await newEnvironmentRow.locator('[data-editable=true]').click();

    await expect.soft(page.locator(focusedEditorWithChild('environment-kv-editor-name'))).toHaveCount(1);
  });

  test('workspace settings dialog focuses the Name field', async ({ page, insomnia }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    await insomnia.navigationSidebar.openWorkspaceActionsDropdown('My first collection');
    await page.getByRole('menuitemradio', { name: 'Settings' }).click();

    await expect.soft(page.getByRole('dialog').getByRole('textbox', { name: 'Name' })).toBeFocused();
  });

  test('tabbing onto the params grid focuses the Name cell', async ({ page }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    await page.getByRole('tab', { name: 'Params' }).click();
    // Move focus onto the params grid the way Tab would: React Aria lands focus on a row, which the
    // editor forwards into the trailing blank row's Name editor so the user can start typing a new pair.
    await page.getByRole('listbox', { name: 'Key-value pairs' }).getByRole('option').first().focus();

    await expect.soft(page.locator(focusedEditorWithChild('key-value-editor__name'))).toHaveCount(1);
  });

  test('Tab from the URL bar moves focus to Send', async ({ page, insomnia }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    await insomnia.navigationSidebar.openWorkspaceActionsDropdown('My first collection');
    await page.getByRole('menuitemradio', { name: 'Http Request' }).click();

    // Fresh request focuses the URL bar; Tab should advance to the Send button. (The URL autofocus
    // re-grab loop must not yank focus back when Tab lands on the Send button.)
    await expect.soft(page.locator(focusedEditorWithChild('request-url-bar'))).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect.soft(page.getByRole('button', { name: 'Send', exact: true })).toBeFocused();
  });

  test('Tab reaches the request tabs and they show a keyboard focus ring', async ({ page, insomnia }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    await insomnia.navigationSidebar.openWorkspaceActionsDropdown('My first collection');
    await page.getByRole('menuitemradio', { name: 'Http Request' }).click();
    await expect.soft(page.locator(focusedEditorWithChild('request-url-bar'))).toHaveCount(1);

    // Tab order out of the URL bar: Send -> send dropdown -> request tablist (Params).
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const paramsTab = page.getByRole('tab', { name: 'Params' });
    await expect.soft(paramsTab).toBeFocused();
    // React Aria marks keyboard focus with data-focus-visible, which drives the visible focus ring.
    await expect.soft(paramsTab).toHaveAttribute('data-focus-visible', 'true');

    // Arrow keys move between the request tabs.
    await page.keyboard.press('ArrowRight');
    await expect.soft(page.getByRole('tab', { name: 'Body' })).toBeFocused();
  });

  test.describe('with an imported collection', () => {
    test.beforeEach(async ({ app, page }) => {
      const text = await loadFixture('simple.yaml');
      await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
      await page.getByLabel('Import').click();
      await page.locator('[data-test-id="import-from-clipboard"]').click();
      await page.getByRole('button', { name: 'Scan' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      // Import lands in the imported collection's debug view; wait for its folder to appear in the sidebar.
      await page.getByTestId('request-node-test folder').waitFor({ state: 'visible' });
    });

    test('Left/Right arrows collapse and expand a folder', async ({ page }) => {
      const folderRow = page.locator('[role="row"]:has([data-testid="request-node-test folder"])');

      // ArrowRight always expands (no-op if already expanded), ArrowLeft always collapses.
      await folderRow.press('ArrowRight');
      await expect.soft(page.getByLabel('Collapse test folder')).toBeVisible();

      await folderRow.press('ArrowLeft');
      await expect.soft(page.getByLabel('Expand test folder')).toBeVisible();

      await folderRow.press('ArrowRight');
      await expect.soft(page.getByLabel('Collapse test folder')).toBeVisible();
    });

    test('Cmd/Ctrl-N adds the request inside the selected folder', async ({ page }) => {
      const folderRow = page.locator('[role="row"]:has([data-testid="request-node-test folder"])');

      // Collapse the folder (ArrowLeft is a no-op if already collapsed) so its later auto-expansion
      // is a clean signal that the new request was nested inside it.
      await folderRow.press('ArrowLeft');
      await expect.soft(page.getByLabel('Expand test folder')).toBeVisible();

      // Select the folder (no request active), then create a request via the keyboard shortcut.
      await page.getByTestId('request-node-test folder').click();
      await page.locator('.app').press('ControlOrMeta+n');

      // Navigating to the new request auto-expands its ancestor folder, proving it was created inside.
      await expect.soft(page.getByLabel('Collapse test folder')).toBeVisible();
    });

    test('request settings dialog focuses the Name field', async ({ page, insomnia }) => {
      await insomnia.navigationSidebar.selectRequestDropdownOption({
        actionName: 'Settings',
        requestName: 'example http',
      });

      await expect.soft(page.getByRole('dialog').getByRole('textbox', { name: 'Name' })).toBeFocused();
    });

    test('folder settings dialog focuses the Name field', async ({ page, insomnia }) => {
      await insomnia.navigationSidebar.selectRequestGroupDropdownOption({
        actionName: 'Settings',
        requestGroupName: 'test folder',
      });

      await expect.soft(page.getByRole('dialog').getByRole('textbox', { name: 'Name' })).toBeFocused();
    });
  });
});
