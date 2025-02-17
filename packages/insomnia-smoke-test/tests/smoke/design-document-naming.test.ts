import { test } from '../../playwright/test';

test.describe('design document operations', async () => {
    test('can name design documents', async ({ page }) => {
        await page.getByRole('button', { name: ' New Document' }).click();
        await page.getByPlaceholder('my-spec.yaml').fill('jurassic park');
        await page.getByPlaceholder('my-spec.yaml').press('Enter');
        await page.getByTestId('project').click();
        await page.getByLabel('Files').getByLabel('jurassic park').click();
    });

    test('can delete a test suite with confirmation modal', async ({ page }) => {
        await page.getByRole('button', { name: ' New Document' }).click();
        await page.getByPlaceholder('my-spec.yaml').fill('jurassic park');
        await page.getByPlaceholder('my-spec.yaml').press('Enter');
        await page.getByTestId('workspace-test').click();
        await page.getByText('New test suite').click();
        await page.getByLabel('Test Suites').getByLabel('Unit Test Actions').click();
        await page.getByRole('menuitemradio', { name: 'Delete suite' }).click();
        await page.locator('.modal__content').getByRole('button', { name: 'Delete' }).click();
    });
});
