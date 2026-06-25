import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test.describe('Spec editor toolbar', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('generate dropdown, format switch, and preview toggle', async ({ page }) => {
    // Setup: create a design document from the Pet Store example
    await page.getByRole('button', { name: 'Create document' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
    await page.click('text=Use example');
    await page.click('text=Pet Store');

    const codeEditor = page.locator('.pane-one').getByTestId('CodeEditor');
    await expect.soft(codeEditor).toContainText('openapi: 3.0.4');

    // The toolbar shows the OpenAPI version label
    await expect.soft(page.locator('.pane-one').getByText('OpenAPI 3.0.4')).toBeVisible();

    // The Generate dropdown exposes the Collection option
    await page.getByRole('button', { name: 'Generate' }).click();
    await expect.soft(page.getByRole('menuitemradio', { name: 'Collection' })).toBeVisible();
    await page.keyboard.press('Escape');

    // The format dropdown converts the spec between YAML and JSON
    const formatButton = page.getByRole('button', { name: 'Spec format' });
    await expect.soft(formatButton).toContainText('YAML');
    await formatButton.click();
    await page.getByRole('menuitemradio', { name: 'JSON' }).click();
    await expect.soft(codeEditor).toContainText('"openapi": "3.0.4"');
    await expect.soft(formatButton).toContainText('JSON');

    // The single preview toggle shows/hides the docs preview pane.
    // A freshly created document starts with the preview collapsed.
    const previewToggle = page.getByTestId('preview-toggle');
    await expect.soft(page.locator('.pane-two')).toBeHidden();
    await previewToggle.click();
    await expect.soft(page.locator('.pane-two')).toBeVisible();
    await previewToggle.click();
    await expect.soft(page.locator('.pane-two')).toBeHidden();
  });
});
