import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

// TODO: Fix git branching and dropdown flakes
test.fixme('Clone Repo with bad values @failing', async ({ page }) => {
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('menuitem', { name: 'Git Clone' }).click();
  await page.getByRole('tab', { name: 'Git' }).nth(2).click();

  // Fill in Git Sync details and clone repository
  await page.getByText('Git URI (https)').fill('https://github.com/kong/dino-park-insomnia');
  await page.getByText('Author Name').fill('test');
  await page.getByText('Author Email').fill('test');
  await page.getByText('Username').fill('test');
  await page.getByText('Authentication Token').fill('test');
  await page.getByRole('dialog').getByRole('button', { name: 'Clone' }).click();

  // Basic check repository data is loaded
  // Design doc
  await page.getByText('"Our Dino Park API"').click();
  await page.getByRole('link', { name: 'Debug' }).click();
  // Requests
  await page.getByRole('button', { name: 'POST Turn on/off the electricity of the fences' }).click();
  // Environments
  await page.getByRole('button', { name: 'No Environment' }).click();
  await page.getByRole('menuitem', { name: 'Use Via Kong GW' }).click();
  // Tests
  await page.getByRole('link', { name: 'Test' }).click();
  await page.getByRole('heading', { name: 'Check status' }).click();

  // Check branch history
  await page.getByTestId('git-dropdown').locator('button').click();
  await page.getByRole('menuitem', { name: 'History' }).click();
  await page.locator('text=Git History').click();

  // Check a recent and old commit show up on history
  await page.getByRole('cell', { name: 'bump to OpenAPI v3.1' }).click();
  await page.getByRole('cell', { name: 'Fix environments' }).click();
  await page.locator('text=Done').click();

  // Create a branch and try to push with bad Git token
  await page.getByTestId('git-dropdown').locator('button').click();
  await page.getByRole('menuitem', { name: 'Branches' }).click();
  await page.getByPlaceholder('testing-branch').fill('test123');
  await page.getByRole('button', { name: '+ Create' }).click();
  await page.getByRole('cell', { name: 'test123(current)' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'test123' }).click();
  await page.getByRole('menuitem', { name: 'Push' }).click();
  await expect(page.locator('.app')).toContainText('Error Pushing Repository');
});

test.fixme('Clone Gitlab Repo with bad values', async ({ page }) => {
  await page.getByRole('button', { name: 'Create in project' }).click();
  await page.getByRole('menuitemradio', { name: 'Git Clone' }).click();
  await page.getByRole('tab', { name: 'Git' }).nth(2).click();

  // Fill in Git Sync details and clone repository
  await page.getByText('Git URI (https)').fill('https://gitlab.com/gitlab-examples/gitlab-examples.gitlab.io.git');
  await page.getByText('Author Name').fill('test');
  await page.getByText('Author Email').fill('test');
  await page.getByText('Username').fill('test');
  await page.getByText('Authentication Token').fill('test');
  await page.getByRole('dialog').getByRole('button', { name: 'Clone' }).click();

  // Create a branch and try to push with bad Git token
  await page.getByRole('button', { name: 'master' }).click();
  await page.getByRole('menuitem', { name: 'Branches' }).click();
  await page.getByPlaceholder('testing-branch').fill('test123');
  await page.getByRole('button', { name: '+ Create' }).click();
  await page.getByRole('cell', { name: 'test123(current)' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'test123' }).click();
  await page.getByRole('menuitem', { name: 'Push' }).click();
  await expect(page.locator('.app')).toContainText('Error Pushing Repository');
});

// TODO(kreosus): more git sync prerelease tests will be added when gh auth secrets are properly setup for CI use

// TODO(kreosus): more preferences scenarios will be added in the followup iterations of increasing app test coverage
