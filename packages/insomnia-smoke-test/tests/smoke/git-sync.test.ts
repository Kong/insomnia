import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('Pull, commit and push', async ({ page }) => {
  await page.getByTestId('settings-button').click();
  await page.getByRole('tab', { name: 'Credentials' }).click();
  await page.getByRole('button', { name: 'Create Git Credential' }).click();
  await page.getByText('Access Token').click();
  await page.getByRole('textbox', { name: 'Author Email' }).click();
  await page.getByRole('textbox', { name: 'Author Email' }).fill('a@b.com');
  await page.getByRole('textbox', { name: 'Author Name' }).click();
  await page.getByRole('textbox', { name: 'Author Name' }).fill('author');
  await page.getByRole('textbox', { name: 'Username' }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('username');
  await page.getByRole('textbox', { name: 'Git Access Token' }).click();
  await page.getByRole('textbox', { name: 'Git Access Token' }).fill('accesstoken');
  await page.getByRole('textbox', { name: 'Repository base URL' }).click();
  await page.getByRole('textbox', { name: 'Repository base URL' }).fill('http://localhost:4010/git/');
  await page.getByRole('button', { name: 'Save Credential' }).click();
  await page.getByRole('button', { name: 'Modal Close Button' }).click();
  await page.getByRole('button', { name: 'Create new Project' }).click();
  await page.getByText('Git Sync').click();
  await page.getByRole('textbox', { name: 'Repository URL' }).click();
  await page.getByRole('textbox', { name: 'Repository URL' }).fill('git-server.git');
  await page.getByRole('button', { name: 'Show suggestions Branch' }).click();
  await page.getByRole('option', { name: 'master' }).click();
  await page.getByRole('button', { name: 'Scan for files' }).click();
  await page.getByRole('button', { name: 'Create Blank Project' }).click();
  const projectModalCloseButton = page.locator('[data-test-id="project-modal-close-button"]');
  await projectModalCloseButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await projectModalCloseButton.isVisible()) {
    await projectModalCloseButton.click();
  }
  await page.getByRole('button', { name: 'Personal workspace' }).click();
  await page.getByRole('option', { name: /Magic/ }).locator('span').click();
  await page.getByRole('button', { name: /Magic/ }).click();
  await page.getByRole('option', { name: 'Personal workspace' }).locator('span').click();
  await page.getByText('My Project').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText('My Project').click();
  await page.getByRole('button', { name: 'New request collection' }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByTestId('git-dropdown').click();
  await page.getByText('Commit').click();
  await page.getByRole('textbox', { name: 'Message' }).click();
  await page.getByRole('textbox', { name: 'Message' }).fill('first commit');
  await page.locator('button[name="Stage all changes"]').click();
  await page.getByRole('button', { name: 'Commit and push' }).click();
  await page.getByTestId('git-dropdown').click();
  await page.getByText('History').click();
  await expect.soft(page.getByRole('rowheader', { name: 'first commit' })).toBeVisible();
});
