import { test } from '../../playwright/test';

test('can open scratchpad', async ({ page }) => {
  await page.getByTestId('user-dropdown').filter({ visible: true }).click();
  await page.getByText('Log Out').click();
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByLabel('Use local Scratch Pad').click();
  await page.getByText('Unlock full features').click();
});
