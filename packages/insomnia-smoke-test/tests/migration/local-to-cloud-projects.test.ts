import { copyFixtureDatabase } from '../../playwright/paths';
import { test } from '../../playwright/test';

const testWithLegacyDatabase = test.extend({
  dataPath: async ({ dataPath }, use) => {
    await copyFixtureDatabase('insomnia-legacy-db', dataPath);

    await use(dataPath);
  },
  userConfig: async ({ }, use) => {
    await use({
      skipOnboarding: true,
      publicKey: 'txb/w8DASTpPQqeHE/hpI3ABKzit+pv5n2We5dbtYRo=',
      secretKey: 'Tb1QKsI3wVZxhS8TuQESHB2x7f68PzeTzTMmLpnnFVU=',
    });
  },
});

testWithLegacyDatabase('Run data migration to version 8', async ({ page }) => {
  const code = 'BTxpIfgXY1VgUpoPpqA25RkCPGQ2MAkZsaY6IZ0bamd0WsYQlJM6iy8PV9hEHS1Gk96SBC6%2BM%2FGhv8IaVl1N6V5wdghHwU2sGKGkW%2Fevx1HiqAUsAqIry8aWRqAkc0n3KmW%2B%2F8lyeHCpy5jhsXqMMqXMbZh8dN1q%2ByRe2C6MJS1A706KbPUhI7PRi%2FsmK0TcNT7lgBKKHRVzPTvjpLcjgzSJFL4K%2BEzgY9Ue4gh0gPw89sM9dV%2F2sAlpw0LA7rF06NyoPhA%3D';

  await page.getByLabel('Continue with Google').click(),

  await page.locator('input[name="code"]').click();
  await page.locator('input[name="code"]').fill(code);

  await page.getByRole('button', { name: 'Log in' }).click();

  // Open migrated Project
  await page.getByLabel('Insomnia').click();

  // Open migrated local migrated collection that should now have Insomnia Sync
  await page.getByLabel('Local Collection').click();
  await page.getByLabel('Select an environment').focus();
  await page.getByLabel('Select an environment').press('Enter');
  await page.getByRole('option', { name: 'Mars' }).click();
  await page.getByRole('menu', { name: 'Select a branch to sync with' }).click();
  await page.getByText('Get list of rockets').click();
  await page.getByTestId('project').click();

  // Open migrated local migrated collection that should have Git Sync
  await page.getByLabel('Local Project (GIT)').click();
  await page.getByTestId('project').click();
  await page.getByLabel('OpenAPI').click();
  await page.getByRole('row', { name: 'DEL Delete user Request Actions' }).click();
  await page.getByText('Use Insomnia SyncGit SyncRepository SettingsBranchesBranchesmainmainCommitPullPu').click();
  await page.getByLabel('Personal Workspace', { exact: true }).click();

  // Open Team that is migrated to Organization
  await page.getByRole('link', { name: '🦄' }).click();

  // Open remote migrated collection that should have Insomnia Sync
  await page.getByLabel('Personal Workspace', { exact: true }).click();
  await page.getByLabel('Remote Design Document', { exact: true }).click();
  await page.getByText('Updated user').click();
  await page.getByRole('menu', { name: 'Select a branch to sync with' }).click();
  await page.getByText('Use Insomnia SyncGit SyncRepository SettingsBranchesBranchesmainmainCommitPullPu').click();
  await page.getByTestId('project').click();

  // Open remote migrated collection that should have GIT Sync
  await page.getByLabel('(GIT) Remote Design Document').click();
  await page.getByRole('row', { name: 'PUT Updated user Request Actions' }).click();
  await page.getByText('Use Insomnia SyncGit SyncRepository SettingsBranchesBranchesmainmainCommitPullPu').click();
  await page.getByTestId('project').click();

  // Open remote migrated collection that should have Insomnia Sync
  await page.getByLabel('Remote Collection', { exact: true }).click();
  await page.getByRole('row', { name: 'GET New Request Request Actions' }).click();
  await page.getByText('New Request').click();
  await page.getByRole('menu', { name: 'Select a branch to sync with' }).click();
  await page.getByTestId('project').click();

  // Open remote migrated collection that should have Insomnia Sync
  await page.getByLabel('Remote Collection', { exact: true }).click();
  await page.getByRole('menu', { name: 'Select a branch to sync with' }).click();
});
