import { test } from '../../playwright/test';

test('can make a mock route: WARNING: THIS TEST DEPENDS ON mock.insomnia.moe to be up', async ({ page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  await page.getByLabel('New Mock Server').click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'New Mock Route' }).click();
  await page.locator('#prompt-input').fill('/123');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByLabel('Mock Route Actions').click();
  await page.getByText('Rename').click();
  await page.locator('#prompt-input').fill('/456');
  await page.getByRole('button', { name: 'Rename' }).click();

  await page.getByRole('button', { name: 'Test' }).click();
  await page.getByText('No body returned for response').click();
  await page.getByRole('tab', { name: 'Console' }).click();
  await page.getByText('HTTP/2 200').click();
});
