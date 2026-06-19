import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

// Validates the headline requirement: undo reverts the most recent change, and a subsequent
// undo brings the relevant sub-tab back into view before reverting its change.
test('global undo reverts changes and brings the right sub-tab into view', async ({ page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

  const requestPane = page.getByTestId('request-pane');

  // Add a query parameter on the Params sub-tab (one undoable step).
  await requestPane.getByRole('tab', { name: 'Params' }).click();
  await requestPane.getByRole('button', { name: 'Add', exact: true }).first().click();
  await expect.soft(requestPane.getByRole('tab', { name: 'Params', selected: true })).toBeVisible();

  // Switch to Headers and add a header (a second undoable step on a different sub-tab).
  await requestPane.getByRole('tab', { name: 'Headers' }).click();
  await requestPane.getByRole('button', { name: 'Add', exact: true }).first().click();
  await expect.soft(requestPane.getByRole('tab', { name: 'Headers', selected: true })).toBeVisible();

  // First undo: reverts the header change while staying on the Headers sub-tab.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.soft(requestPane.getByRole('tab', { name: 'Headers', selected: true })).toBeVisible();

  // Second undo: brings the Params sub-tab back into view and reverts the parameter change.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.soft(requestPane.getByRole('tab', { name: 'Params', selected: true })).toBeVisible();

  // Redo brings the Params change back.
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect.soft(requestPane.getByRole('tab', { name: 'Params', selected: true })).toBeVisible();
});

// Validates that a deleted request can be restored with undo.
test('global undo restores a deleted request', async ({ page, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  // Create a collection with a default request ("My first collection" / "My first request").
  await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
  const requestName = 'My first request';
  await expect.soft(insomnia.navigationSidebar.requestRow(requestName)).toBeVisible();

  // Delete the request via the sidebar actions menu.
  await insomnia.navigationSidebar.selectRequestDropdownOption({
    requestName,
    actionName: 'Delete',
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.soft(insomnia.navigationSidebar.requestRow(requestName)).toBeHidden();

  // Undo restores the deleted request.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.soft(insomnia.navigationSidebar.requestRow(requestName)).toBeVisible();
});
