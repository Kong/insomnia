import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

// Regression tests for the table views swallowing the space key: the react-aria
// ListBox typeahead intercepts a space keydown (capture phase, preventDefault +
// stopPropagation) whenever its search buffer is non-empty, i.e. within 1s of the
// previous printable key. A name like "My key" could only be typed as "Mykey" plus
// manual arrow-key insertion. `disallowTypeAhead` on the ListBoxes lets every
// keystroke reach the cell's OneLineEditor (CodeMirror).
// Human-like typing delay (~120ms) keeps the typeahead buffer warm between keys, so
// a swallowed space reproduces deterministically; delay:0 bursts do not.
// Exact-text assertions read `.CodeMirror-code`: the textContent of `.CodeMirror`
// includes CodeMirror's internal measure node, which always contains "xxxxxxxxxx".
const humanTypingDelay = 120;

test.describe('Key-value editor space typing', () => {
  test('environment table: spaces can be typed directly into names and values', async ({ page, insomnia }) => {
    await insomnia.projectPage.importFixture('environments.yaml');

    await page.getByLabel('Select an API Collection Environment').click();
    await page.getByRole('button', { name: 'Manage API collection environments' }).click();
    await page.getByLabel('Environments', { exact: true }).getByText('ExampleA').click();
    await page.getByRole('button', { name: 'Table Edit' }).click();

    const kvTable = page.getByRole('listbox', { name: 'Environment Key Value Pair' });
    await expect.soft(kvTable).toContainText('exampleString');
    const optionsBefore = await kvTable.getByRole('option').count();

    // Type a name containing a space without pausing; the space must land in the editor.
    // Both call sites share this locator, kept in lockstep on purpose.
    const blankRowEditor = () => kvTable.getByRole('option').last().getByTestId('OneLineEditor').first().locator('.CodeMirror');
    await blankRowEditor().click();
    await page.keyboard.type('My key', { delay: humanTypingDelay });
    await expect.soft(kvTable.getByRole('option')).toHaveCount(optionsBefore + 1);
    await expect.soft(kvTable).toContainText('My key');

    // Multiple consecutive spaces must all be inserted. The exact-text poll bypasses
    // toHaveText/toContainText's whitespace normalization, which would hide a
    // partially swallowed space. Pin the row by index: after the commit a fresh blank
    // row takes over .last().
    await blankRowEditor().click();
    await page.keyboard.type('val1  val2', { delay: humanTypingDelay });
    await expect.soft(kvTable.getByRole('option')).toHaveCount(optionsBefore + 2);
    const committedRow = kvTable.getByRole('option').nth(optionsBefore);
    await expect.poll(() => committedRow.locator('.CodeMirror-code').first().evaluate(el => el.textContent ?? '')).toBe('val1  val2');
  });

  test('request headers: spaces can be typed directly into names and values', async ({ page }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
    await page.getByRole('tab', { name: 'Headers' }).click();

    const listbox = page.getByRole('listbox', { name: 'Key-value pairs', exact: true });

    // Create a real row via Add instead of typing into the trailing blank row: the
    // blank-row commit round-trip drops DOM focus mid-word (separate, pre-existing
    // concern). An added row is stable, so slow typing here guards the space fix.
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect.soft(listbox.getByRole('option')).toHaveCount(2);

    await listbox.getByRole('option').first().getByTestId('OneLineEditor').first().locator('.CodeMirror').click();
    await page.keyboard.type('My Header', { delay: humanTypingDelay });
    await expect.soft(listbox).toContainText('My Header');

    // Spaces in the value editor must survive too, including consecutive ones.
    const headerValueEditor = listbox.getByRole('option').first().getByTestId('OneLineEditor').nth(1).locator('.CodeMirror-code');
    await headerValueEditor.click();
    await page.keyboard.type('val1  val2', { delay: humanTypingDelay });
    await expect.poll(() => headerValueEditor.evaluate(el => el.textContent ?? '')).toBe('val1  val2');
  });

  test('query params: spaces can be typed directly into names', async ({ page }) => {
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
    await page.getByRole('tab', { name: 'Params' }).click();

    const listbox = page.getByRole('listbox', { name: 'Key-value pairs', exact: true });

    // Same bypass as the headers test above: add a stable row instead of typing into
    // the trailing blank row, whose commit round-trip drops DOM focus mid-word.
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect.soft(listbox.getByRole('option')).toHaveCount(2);

    // The Add flow autofocuses the new row's name editor (pendingFocusLastRowId),
    // so type directly; clicking the editor races the resizable-panel layout here.
    await page.keyboard.type('My Param', { delay: humanTypingDelay });
    await expect.soft(listbox).toContainText('My Param');
  });
});
