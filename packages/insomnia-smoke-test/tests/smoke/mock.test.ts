import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can make a mock route', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const text = await loadFixture('smoke-test-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByRole('button', { name: 'Create in project' }).click();
  await page.getByRole('menuitemradio', { name: 'Import' }).click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await page.getByLabel('New Mock Server').click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'New Mock Route' }).click();
  await page.getByText('GET/').click();
  await page.getByTestId('CodeEditor').getByRole('textbox').fill('123');

  await page.getByRole('button', { name: 'Test' }).click();
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await page.getByText('HTTP/2 200').click();
});
