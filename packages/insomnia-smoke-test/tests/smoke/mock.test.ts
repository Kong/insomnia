import { test } from '../../playwright/test';

test('can make a mock route', async ({ page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  await page.getByLabel('New Mock Server').click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'New Mock Route' }).click();
  await page.getByText('GET/').click();
  await page.getByTestId('CodeEditor').getByRole('textbox').fill('123');
  await page.getByRole('tab', { name: 'Response Headers' }).click();
  await page.locator('.CodeMirror').first().click();
  await page.getByRole('textbox').nth(1).fill('my-header');
  await page.getByRole('textbox').nth(2).fill('my-value');
  await page.getByRole('tab', { name: 'Response Status' }).click();
  await page.getByPlaceholder('200').click();
  await page.getByPlaceholder('200').fill('201');

  await page.getByRole('button', { name: 'Test' }).click();
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await page.getByText('201').click();
});
