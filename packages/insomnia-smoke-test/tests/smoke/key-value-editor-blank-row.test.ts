import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// These tests cover the trailing "blank row" behavior of the key-value editors:
// a placeholder row is always rendered at the end of the list and is only persisted once
// the user starts typing into it (so it never pollutes the saved data / diffs while
// empty). Typing commits it as a real pair and a fresh blank row takes its place.

test.describe('Key-value editor blank row', () => {
  test('request headers: blank row is always shown, is not persisted while empty, and commits on typing', async ({ page }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
    await page.getByRole('tab', { name: 'Headers' }).click();

    const listbox = page.getByRole('listbox', { name: 'Key-value pairs', exact: true });
    const deleteAll = page.getByRole('button', { name: 'Delete all' });

    // A fresh request has no headers, but the blank row is always shown. "Delete all"
    // stays disabled because the blank row is not part of the persisted data.
    await expect.soft(listbox.getByRole('option')).toHaveCount(1);
    await expect.soft(deleteAll).toBeDisabled();

    // Typing into the blank row commits it as a real header; a fresh blank row appears
    // and "Delete all" becomes enabled now that there is persisted data.
    await listbox.getByRole('option').last().getByTestId('OneLineEditor').first().locator('.CodeMirror').click();
    await page.keyboard.type('x');
    await expect.soft(listbox.getByRole('option')).toHaveCount(2);
    await expect.soft(deleteAll).toBeEnabled();

    // Set a real name on the committed (first) row and confirm it is rendered.
    const committedRow = listbox.getByRole('option').first();
    await committedRow.getByTestId('OneLineEditor').first().locator('.CodeMirror').click();
    await page.keyboard.type('X-Custom-Header');
    await expect.soft(committedRow).toContainText('X-Custom-Header');

    // Clear all persisted headers. "Delete all" is a confirm button: the first click
    // arms it (its label changes to "Click to confirm"), the second confirms. The list
    // falls back to a single blank row and "Delete all" disables again, confirming the
    // trailing blank row is never itself persisted.
    await deleteAll.click();
    await page.getByRole('button', { name: 'Click to confirm' }).click();
    await expect.soft(listbox.getByRole('option')).toHaveCount(1);
    await expect.soft(deleteAll).toBeDisabled();
  });

  test('query params: blank row is always shown and is not persisted while empty', async ({ page }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
    await page.getByRole('tab', { name: 'Params' }).click();

    const listbox = page.getByRole('listbox', { name: 'Key-value pairs', exact: true });

    // The blank row is always rendered for query parameters too, and is not persisted
    // (so "Delete all" is disabled until the user adds a real parameter).
    await expect.soft(listbox.getByRole('option')).toHaveCount(1);
    await expect.soft(page.getByRole('button', { name: 'Delete all' })).toBeDisabled();
  });

  test('environment table editor: blank row is always shown and commits on typing', async ({ page, app }) => {
    const text = await loadFixture('environments.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });

    // Open the table editor for the ExampleA sub-environment.
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    await page.getByLabel('Environments', { exact: true }).getByText('ExampleA').click();
    await page.getByRole('button', { name: 'Table Edit' }).click();

    const kvTable = page.getByRole('listbox', { name: 'Environment Key Value Pair' });

    // Wait for the existing ExampleA pairs to render before counting.
    await expect.soft(kvTable).toContainText('exampleString');
    const optionsBefore = await kvTable.getByRole('option').count();

    // Type into the trailing blank row's name editor to commit it.
    await kvTable.getByRole('option').last().getByTestId('OneLineEditor').first().locator('.CodeMirror').click();
    await page.keyboard.type('blankRowKey');

    // The blank row commits and a fresh blank row takes its place.
    await expect.soft(kvTable.getByRole('option')).toHaveCount(optionsBefore + 1);
    await expect.soft(kvTable).toContainText('blankRowKey');
  });
});
