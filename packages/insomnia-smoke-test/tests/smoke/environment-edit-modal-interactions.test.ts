import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Environment Edit Modal', async () => {

    test.beforeEach(async ({ app, page }) => {
        await page.getByRole('button', { name: 'Create in project' }).click();
        const text = await loadFixture('environment-overrides.yaml');
        await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
        await page.getByRole('menuitemradio', { name: 'Import' }).click();
        await page.locator('[data-test-id="import-from-clipboard"]').click();
        await page.getByRole('button', { name: 'Scan' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
        await page.getByText('Test Environment Modal').click();
    });

    // rename an existing environment
    test('Add new string variable to new environment overrides folder', async ({ page }) => {
        // Create new Folder
        await page.getByLabel('Create in collection').click();
        await page.getByLabel('New Folder').click();
        await page.locator('#prompt-input').fill('New Folder');
        await page.getByText('New Folder').press('Enter');

        // Open 'New folder' folder
        await page.getByTestId('Dropdown-New-Folder').click();
        await page.getByRole('menuitemradio', { name: 'Environment' }).click();

        // Add a new string environment variable
        const expected = '{ "foo":"bar" }';
        const editor = await page.getByTestId('CodeEditor').getByRole('textbox');
        const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
        await editor.press(selectAllShortcut);
        await editor.fill(expected);

        // Close and re-open modal
        await page.getByText('Close').click();
        await page.getByTestId('Dropdown-New-Folder').click();
        await page.getByRole('menuitemradio', { name: 'Environment' }).click();

        // Validate expected values persisted
        const rawOverrides = page.getByTestId('CodeEditor').locator('.CodeMirror-line');
        const actualRows = await rawOverrides.allInnerTexts();
        expect(actualRows.length).toBeGreaterThan(0);

        const actualJSON = JSON.parse(actualRows.join(' '));
        expect(actualJSON).toEqual(JSON.parse(expected));
    });

    test('Add new string variable to an existing environment overrides folder', async ({ page }) => {
        // Open 'Test Folder' folder
        await page.getByTestId('Dropdown-Test-Folder').click();
        await page.getByRole('menuitemradio', { name: 'Environment' }).click();

        // Add a new string environment variable to existing overrides

        // 1. Retrieve current editor rows
        let rawOverrides = page.getByTestId('CodeEditor').locator('.CodeMirror-line');
        const rows = await rawOverrides.allInnerTexts();

        // 2. Merge rows and convert to JSON
        const editorJSON = JSON.parse(rows.join(' '));

        // 3. Modify JSON with new string environment variable
        editorJSON.REQUEST = 'HTTP';
        const expected = editorJSON;

        // 4. Apply new JSON to editor
        const editor = await page.getByTestId('CodeEditor').getByRole('textbox');
        const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
        await editor.press(selectAllShortcut);
        await editor.fill(JSON.stringify(expected));

        // Close and re-open Modal
        await page.getByText('Close').click();
        await page.getByTestId('Dropdown-Test-Folder').click();
        await page.getByRole('menuitemradio', { name: 'Environment' }).click();

        // Validate expected values persisted
        rawOverrides = page.getByTestId('CodeEditor').locator('.CodeMirror-line');
        const actualRows = await rawOverrides.allInnerTexts();
        expect(actualRows.length).toBeGreaterThan(0);

        const actualJSON = JSON.parse(actualRows.join(' '));
        expect(actualJSON).toEqual(expected);

    });

    test('Update existing variable in environment override', async ({ page }) => {
        // Open 'Test Folder' folder
        await page.getByTestId('Dropdown-Test-Folder').click();
        await page.getByRole('menuitemradio', { name: 'Environment' }).click();

        // Update 'insomnia' string environment variable

        // 1. Retrieve current editor rows
        let rawOverrides = page.getByTestId('CodeEditor').locator('.CodeMirror-line');
        const rows = await rawOverrides.allInnerTexts();

        // 2. Merge rows and convert to JSON
        const editorJSON = JSON.parse(rows.join(' '));

        // 3. Modify JSON with updated string environment variable
        editorJSON.insomnia = 'RestClient';
        const expected = editorJSON;

        // 4. Apply new JSON to editor
        const editor = await page.getByTestId('CodeEditor').getByRole('textbox');
        const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
        await editor.press(selectAllShortcut);
        await editor.fill(JSON.stringify(expected));

        // Close and re-open Modal
        await page.getByText('Close').click();
        await page.getByTestId('Dropdown-Test-Folder').click();
        await page.getByRole('menuitemradio', { name: 'Environment' }).click();

        // Validate expected values persisted
        rawOverrides = page.getByTestId('CodeEditor').locator('.CodeMirror-line');
        const actualRows = await rawOverrides.allInnerTexts();
        expect(actualRows.length).toBeGreaterThan(0);

        const actualJSON = JSON.parse(actualRows.join(' '));
        expect(actualJSON).toEqual(expected);
    });
});
