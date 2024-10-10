import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Global Environments', async () => {

    test('create a new global environment', async ({ page }) => {
        await page.getByLabel('Create in project').click();
        await page.getByLabel('Create', { exact: true }).getByText('Environment').click();
        await page.getByRole('button', { name: 'Create', exact: true }).click();
        await page.getByTestId('CreateEnvironmentDropdown').click();
        await page.getByText('Private environment').click();
        await page.getByLabel('Project Actions').click();
        await page.getByText('Duplicate').click();
        await page.getByText('New Environment (Copy)').click();
    });

    test('import and use a global environment from a collection', async ({ app, page }) => {
        await loadFixtureFile('collection-for-global-environments.yaml', app, page);
        await loadFixtureFile('global-environment.yaml', app, page);

        await page.getByRole('link', { name: 'collection-for-global-' }).click();
        await page.getByTestId('New Request').getByLabel('GET New Request', { exact: true }).click();
        await page.getByRole('button', { name: 'Send' }).click();
        await page.getByRole('heading', { name: '2 environment variables are' }).click();
        await page.getByRole('button', { name: 'Cancel' }).click();
        await page.getByLabel('Manage Environments').click();
        await page.getByPlaceholder('Choose a global environment').click();
        await page.getByRole('option', { name: 'global-environment' }).click();
        await page.getByText('New Environment').click();
        await page.getByTestId('underlay').click();
        await page.getByRole('button', { name: 'Send' }).click();
        await page.getByRole('tab', { name: 'Console' }).click();
        await page.locator('pre').filter({ hasText: '| 4444' }).click();
        await page.locator('pre').filter({ hasText: '| 55555' }).click();
    });

});
async function loadFixtureFile(fixture: string, app, page) {
    const text = await loadFixture(fixture);
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
}
