import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can load methods through the buf reflection API', async ({ app, page, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const text = await loadFixture('grpc-reflection-api.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await insomnia.navigationSidebar.clickRequestOrFolder('ReflectionApiUnary');
  await page.getByTestId('button-server-reflection').click();

  await page.getByRole('button', { name: 'Select Method' }).click();
  await expect.soft(page.getByRole('option', { name: 'RouteGuide/GetFeature' })).toBeVisible();
});

test('shows an error for an invalid reflection api key', async ({ app, page, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const text = await loadFixture('grpc-reflection-api.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await insomnia.navigationSidebar.clickRequestOrFolder('ReflectionApiInvalidKey');
  await page.getByTestId('button-server-reflection').click();

  await expect.soft(page.getByRole('dialog')).toContainText('Invalid reflection server api key');
});
