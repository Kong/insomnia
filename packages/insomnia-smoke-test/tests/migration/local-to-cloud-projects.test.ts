import { copyFixtureDatabase } from '../../playwright/paths';
import { test } from '../../playwright/test';

const testWithLegacyDatabase = test.extend({
  dataPath: async ({ dataPath }, use) => {
    await copyFixtureDatabase('insomnia-legacy-db', dataPath);

    await use(dataPath);
  },
  userConfig: async ({ userConfig }, use) => {
    await use({
      ...userConfig,
      session: undefined,
    });
  },
});

// tests new cloud project create but not the vcs part as its too complex to stub the gql endpoint
testWithLegacyDatabase('Run data migration to version 8', async ({ page, userConfig }) => {
  // Migration takes a while, adding this to avoid test timeout before it ends
  test.slow();

  await page.getByLabel('Continue with Google').click(),

  await page.locator('input[name="code"]').click();
  await page.locator('input[name="code"]').fill(userConfig.code);

  await page.getByRole('button', { name: 'Log in' }).click();

  // Open migrated Project (Local before migration)
  await page.getByLabel('Insomnia').click();

  // Open migrated local migrated collection that should now have Insomnia Sync
  await page.getByLabel('Local Collection').click();
  await page.getByLabel('Mars', { exact: true }).click();
  await page.getByRole('option', { name: 'Mars' }).click();
  await page.getByLabel('Insomnia Sync').isVisible();
  await page.getByText('Get list of rockets').click();
  await page.getByTestId('project').click();

  // Open migrated local migrated collection that should have Git Sync
  await page.getByLabel('Local Project (GIT)').click();
  await page.getByLabel('OpenAPI').click();
  await page.getByText('Delete user').click();
  await page.getByLabel('Git Sync').isVisible();
  await page.getByTestId('project').click();

  await page.getByLabel('Personal Workspace', { exact: true }).click();

  // Open Team that is migrated to Organization
  await page.getByRole('link', { name: '🦄' }).click();

  // Open remote migrated collection that should have Insomnia Sync
  await page.getByLabel('Personal Workspace', { exact: true }).click();
  await page.getByLabel('Remote Design Document', { exact: true }).click();
  await page.getByText('Updated user').click();
  await page.getByLabel('Insomnia Sync').isVisible();
  await page.getByTestId('project').click();

  // Open remote migrated collection that should have GIT Sync
  await page.getByLabel('(GIT) Remote Design Document').click();
  await page.getByText('Updated user').click();
  await page.getByLabel('Git Sync').isVisible();
  await page.getByTestId('project').click();

  // Open remote migrated collection that should have Insomnia Sync
  await page.getByLabel('Remote Collection', { exact: true }).click();
  await page.getByText('New Request').click();
  await page.getByLabel('Insomnia Sync').isVisible();
  await page.getByTestId('project').click();

  // Open remote migrated collection that should have Insomnia Sync
  await page.getByLabel('Remote Collection', { exact: true }).click();
  await page.getByLabel('Insomnia Sync').isVisible();
});
