import { test } from '../../playwright/test';

test('Clone from generic Git server', async ({ page }) => {
  // waitting for the /features api request to finish
  await page.waitForSelector('[data-test-git-enable="true"]');
  await page.getByLabel('Clone git repository').click();
  await page.getByRole('tab', { name: ' Git' }).click();
  await page.getByPlaceholder('https://github.com/org/repo.git').fill('https://github.com/Kong/insomnia-git-example.git');
  await page.getByPlaceholder('Name').fill('J');
  await page.getByPlaceholder('Email').fill('J');
  await page.getByPlaceholder('MyUser').fill('J');
  await page.getByPlaceholder('88e7ee63b254e4b0bf047559eafe86ba9dd49507').fill('J');
  await page.getByTestId('git-repository-settings-modal__sync-btn').click();
  await page.getByLabel('Toggle preview').click();
});

test('Sign in with GitHub', async ({ page }) => {
  await page.getByRole('button', { name: 'New Document' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await page.getByLabel('Insomnia Sync').click();
  await page.getByRole('menuitemradio', { name: 'Switch to Git Repository' }).click();

  await page.getByRole('tab', { name: 'GitHub' }).click();

  await page.getByText('Authenticate with GitHub').click();

  await page.locator('input[name="link"]').click();

  await page.locator('input[name="link"]').fill('insomnia://oauth/github-app/authenticate?state=12345&code=12345');

  await page.getByRole('button', { name: 'Authenticate' }).click();

  await page.locator('button[id="github_repo_select_dropdown_button"]').click();

  await page.getByLabel('kong-test/sleepless').click();

  await page.locator('data-testid=git-repository-settings-modal__sync-btn').click();
});
