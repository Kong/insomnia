import { test } from '../../playwright/test';

test('can name design documents', async ({ page }) => {
    await page.getByRole('button', { name: ' New Document' }).click();
    await page.getByPlaceholder('my-spec.yaml').fill('jurassic park');
    await page.getByPlaceholder('my-spec.yaml').press('Enter');
    await page.getByLabel('jurassic park').click();
    await page.getByRole('button', { name: 'jurassic park ' }).press('Escape');
    await page.getByTestId('project').click();
    await page.getByLabel('jurassic park').click();
});
