import { test } from '../../playwright/test';

test('Sign in with Gitlab', async ({ page }) => {
  await page.getByRole('button', { name: 'New Document' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await page.getByLabel('Insomnia Sync').click();
  await page.getByRole('menuitemradio', { name: 'Switch to Git Repository' }).click();
  await page.getByRole('tab', { name: 'GitLab' }).click();

  await page.getByText('Authenticate with GitLab').click();

  await page.locator('input[name="link"]').click();
  await page.locator('input[name="link"]').fill('insomnia://oauth/gitlab/authenticate?code=12345&state=12345');
  await page.getByRole('button', { name: 'Authenticate' }).click();

  test.expect(await page.locator('text="Mark Kim"')).toBeTruthy();
  test.expect(await page.locator('button[name="sign-out"]')).toBeTruthy();
});
