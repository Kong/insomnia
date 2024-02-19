import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can cancel pre-request script', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const text = await loadFixture('pre-request-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByRole('button', { name: 'Create in project' }).click();
  await page.getByRole('menuitemradio', { name: 'Import' }).click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await page.getByRole('button', { name: 'Workspace actions menu button' }).click();
  await page.getByRole('menuitem', { name: 'Export' }).click();
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByText('Which format would you like to export as?').click();
  await page.locator('.app').press('Escape');

  await page.getByText('Pre-request Scripts').click();

  await page.getByLabel('Request Collection').getByTestId('Long running task').press('Enter');
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

  await page.getByRole('button', { name: 'Cancel Request' }).click();
  await page.click('text=Request was cancelled');
});
