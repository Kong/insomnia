import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';;

test.describe('after-response script features tests', async () => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

    test.beforeEach(async ({ app, page }) => {
        const text = await loadFixture('after-response-collection.yaml');
        await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

        await page.getByRole('button', { name: 'Create in project' }).click();
        await page.getByRole('menuitemradio', { name: 'Import' }).click();
        await page.locator('[data-test-id="import-from-clipboard"]').click();
        await page.getByRole('button', { name: 'Scan' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

        await page.getByLabel('After-response Scripts').click();
    });

    test('insomnia.test and insomnia.expect can work together', async ({ page }) => {
        const responsePane = page.getByTestId('response-pane');

        await page.getByLabel('Request Collection').getByTestId('tests with expect and test').press('Enter');

        // send
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

        // verify
        await page.getByRole('tab', { name: 'Timeline' }).click();

        await expect(responsePane).toContainText('✓ happy tests');
        await expect(responsePane).toContainText('✕ unhappy tests: AssertionError: expected 199 to deeply equal 200');
    });

    test('environment and baseEnvironment can be persisted', async ({ page }) => {
        const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
        await page.getByLabel('Request Collection').getByTestId('persist environments').press('Enter');

        // send
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

        // verify response
        await page.waitForSelector('[data-testid="response-status-tag"]:visible');
        await expect(statusTag).toContainText('200 OK');

        // verify persisted environment
        await page.getByRole('button', { name: 'Manage Environments' }).click();
        await page.getByRole('button', { name: 'Manage collection environments' }).click();
        const responseBody = page.getByRole('dialog').getByTestId('CodeEditor').locator('.CodeMirror-line');
        const rows = await responseBody.allInnerTexts();
        const bodyJson = JSON.parse(rows.join(' '));

        expect(bodyJson).toEqual({
            // no environment is selected so the environment value is not persisted
            '__fromAfterScript1': 'baseEnvironment',
            '__fromAfterScript2': 'collection',
        });
    });
});
