import { test } from '../../playwright/test';

test.describe('design document operations', () => {
  test('can name design documents', async ({ page }) => {
    await page.getByRole('button', { name: 'Create document' }).click();
    await page.locator('body').click();
    await page.getByPlaceholder('Enter a name for your API Collection').fill('jurassic park');
    await page.getByPlaceholder('Enter a name for your API Collection').press('Enter');
    await page.getByTestId('workspace-breadcrumb-level-0').click();
    await page.getByLabel('Files').getByLabel('jurassic park').click();
  });

  test('can delete a test suite with confirmation modal', async ({ page, insomnia }) => {
    await page.getByRole('button', { name: 'Create document' }).click();
    await page.getByPlaceholder('Enter a name for your API Collection').fill('jurassic park');
    await page.getByPlaceholder('Enter a name for your API Collection').press('Enter');
    // Show test suite in settings
    await insomnia.statusbar.openPreferences();
    await page.locator('input[name="enableLegacyUnitTests"]').click();
    await insomnia.preferencesPage.closePreferences();
    await page.getByTestId('workspace-test').click();
    await page.getByText('New test suite').click();
    await page.getByLabel('Test Suites').getByLabel('Unit Test Actions').click();
    await page.getByRole('menuitemradio', { name: 'Delete suite' }).click();
    await page.locator('.modal__content').getByRole('button', { name: 'Delete' }).click();
  });
});
