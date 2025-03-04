import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

const testVaultKey = 'eyJhbGciOiJBMjU2R0NNIiwiZXh0Ijp0cnVlLCJrIjoiaEoxaW03cjcwV3ltZ3puT3hXcDNTb0ZQS3RBaGMwcmFfd2VQb2Z2b2xRNCIsImtleV9vcHMiOlsiZW5jcnlwdCIsImRlY3J5cHQiXSwia3R5Ijoib2N0In0=';
const testVaultSalt = 'e619272433fc739d52ff1ba1b45debedfe55cb42685af10a46e2b1285acb7120';
const tesSrpSecret = 'b424e8700ef89f77a6cffc648b9c6d42bb7de58914d88cd79966684ffe5b4ebe';

test('Check vault key generation', async ({ page }) => {
  await page.getByTestId('settings-button').click();
  await page.locator('text=Insomnia Preferences').first().click();
  // generate vault key
  await page.getByRole('button', { name: 'Generate Vault Key' }).click();
  const vaultKeyValue = await page.getByTestId('VaultKeyDisplayPanel').innerText();
  expect(vaultKeyValue.length).toBeGreaterThan(0);
  await page.locator('.app').press('Escape');
  // check secret vault environment could be created
  await page.getByLabel('Create in project').click();
  await page.getByLabel('Create', { exact: true }).getByText('Environment').click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByTestId('CreateEnvironmentDropdown').click();
  await page.getByText('Private environment').click();
  // activate created private environment
  await page.getByRole('grid', { name: 'Environments' }).getByText('New Environment').click();

  const kvTable = await page.getByRole('listbox', { name: 'Environment Key Value Pair' });
  // add first secret environment
  const firstRow = await kvTable.getByRole('option').first();
  await firstRow.getByTestId('OneLineEditor').first().click();
  await page.keyboard.type('foo');
  await firstRow.getByTestId('OneLineEditor').nth(1).click();
  await page.keyboard.type('bar');
  await page.waitForTimeout(500);
  await firstRow.getByRole('button', { name: 'Type Selection' }).click();
  await page.getByRole('menuitemradio', { name: 'Secret' }).click();
  await expect(firstRow.locator('.fa-eye-slash')).toBeVisible();
  await firstRow.locator('.fa-eye-slash').click();
  // test decrypt secret in UI
  await expect(firstRow.getByTestId('OneLineEditor').nth(1)).toContainText('bar');
});

test.describe('Vault key actions', async () => {
  test.use({
    userConfig: async ({ userConfig }, use) => {
      await use({
        ...userConfig,
        vaultSalt: testVaultSalt,
        vaultSrpSecret: tesSrpSecret,
      });
    },
  });

  test('check reset vault key', async ({ page }) => {
    await page.getByTestId('settings-button').click();
    await page.locator('text=Insomnia Preferences').first().click();
    await page.getByRole('button', { name: 'Enter Vault Key' }).click();
    await page.getByText('Reset Vault Key').click();
    await page.getByText('Yes').click();
    const modal = await page.getByTestId('input-vault-key-modal');
    expect(modal).toBeVisible();
    const vaultKeyValueInModal = await modal.getByTestId('VaultKeyDisplayPanel').innerText();
    expect(vaultKeyValueInModal.length).toBeGreaterThan(0);
    await page.getByText('OK').click();
    const vaultKeyValue = await page.getByTestId('VaultKeyDisplayPanel').innerText();
    expect(vaultKeyValue).toEqual(vaultKeyValueInModal);
  });

  test('check reset vault key in private environment', async ({ page, app }) => {
    // import global environment
    const vaultEnvText = await loadFixture('vault-environment.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), vaultEnvText);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByText('Global env with secret vault').click();
    await page.getByText('Reset Vault Key').click();
    await page.getByText('Yes').click();
    const vaultKeyValueInModal = await page.getByTestId('VaultKeyDisplayPanel').innerText();
    expect(vaultKeyValueInModal.length).toBeGreaterThan(0);
  });

  test('check vault key validation', async ({ page }) => {
    await page.getByTestId('settings-button').click();
    await page.locator('text=Insomnia Preferences').first().click();
    // validate vault key
    await page.getByRole('button', { name: 'Enter Vault Key' }).click();
    const modal = await page.getByTestId('input-vault-key-modal');
    expect(modal).toBeVisible();
    // fill the input with aria lable test with valid and invalid vault key
    await page.getByLabel('Vault Key Input').fill('invalidVaultKey');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await modal.getByText('M2 didn\'t Check').click();
  });
});

test.describe('Check vault used in environment', async () => {
  test.use({
    userConfig: async ({ userConfig }, use) => {
      await use({
        ...userConfig,
        vaultKey: testVaultKey,
        vaultSalt: testVaultSalt,
      });
    },
  });

  // skip the flaky test and fix it later
  test('create global private sub environment to store vaults', async ({ page, app }) => {
    // import request
    const requestColText = await loadFixture('vault-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), requestColText);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  // create global private environment
    await page.getByLabel('Create in project').click();
    await page.getByLabel('Create', { exact: true }).getByText('Environment').click();
    await page.getByPlaceholder('New environment').fill('New Global Vault Environment');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByTestId('CreateEnvironmentDropdown').click();
    await page.getByText('Private environment').click();
    // activate created private environment
    await page.getByRole('grid', { name: 'Environments' }).getByText('New Environment').click();

    const kvTable = await page.getByRole('listbox', { name: 'Environment Key Value Pair' });
    // add first secret environment
    const firstRow = await kvTable.getByRole('option').first();
    await firstRow.getByTestId('OneLineEditor').first().click();
    await page.keyboard.type('foo');
    await firstRow.getByTestId('OneLineEditor').nth(1).click();
    await page.keyboard.type('bar');
    await page.waitForTimeout(500);
    await firstRow.getByRole('button', { name: 'Type Selection' }).click();
    await page.getByRole('menuitemradio', { name: 'Secret' }).click();
    await expect(firstRow.locator('.fa-eye-slash')).toBeVisible();
    await firstRow.locator('.fa-eye-slash').click();
    // test decrypt secret in UI
    await expect(firstRow.getByTestId('OneLineEditor').nth(1)).toContainText('bar');

    // add second secret environment
    await page.getByRole('button', { name: 'Add Row' }).click();
    const secondRow = await kvTable.getByRole('option').nth(1);
    await secondRow.getByTestId('OneLineEditor').first().click();
    await page.keyboard.type('hello');
    await secondRow.getByTestId('OneLineEditor').nth(1).click();
    await page.keyboard.type('world');
    await page.waitForTimeout(500);
    await secondRow.getByRole('button', { name: 'Type Selection' }).click();
    await page.getByRole('menuitemradio', { name: 'Secret' }).click();

    // go back
    await page.locator('[data-icon="chevron-left"]').filter({ has: page.locator(':visible') }).first().click();

    // activate global private vault environment
    await page.getByText('Vault Collection').click();
    await page.getByLabel('Manage Environments').click();
    await page.getByPlaceholder('Choose a global environment').click();
    await page.getByRole('option', { name: 'New Global Vault Environment' }).click();
    await page.getByRole('option', { name: 'New Environment' }).click();
    await page.getByText('Base Environment1').click();
    await page.getByTestId('underlay').click();
    // activate request
    await page.getByTestId('normal').getByLabel('GET normal', { exact: true }).click();
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
    await page.getByText('bar').click();
    await page.getByText('world').click();
  });

  test('test vault environment to be applied', async ({ app, page }) => {
    // import global environment
    const vaultEnvText = await loadFixture('vault-environment.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), vaultEnvText);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    // import request
    const requestColText = await loadFixture('vault-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), requestColText);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByText('Vault Collection').click();

    // allow vault to be accessed by the request
    await page.getByTestId('settings-button').click();
    await page.locator('text=Insomnia Preferences').first().click();
    await page.locator('text=Enable vault in scripts').click();
    await page.locator('.app').press('Escape');
    await page.waitForTimeout(1000);

    // activate global private vault environment
    await page.getByLabel('Manage Environments').click();
    await page.getByPlaceholder('Choose a global environment').click();
    await page.getByRole('option', { name: 'Global env with secret vault' }).click();
    await page.getByText('vault env').click();
    // activate legacy array vault environment
    await page.getByText('legacy vault value array').click();
    await page.getByTestId('underlay').click();
    // activate request
    await page.getByTestId('legacy-array-vault').getByLabel('GET legacy-array-vault', { exact: true }).click();
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Console' }).click();
    await page.getByText('password').click();
    await page.getByText('bar').click();
    await page.getByText('world').click();
    await page.getByText('vault_array_a').click();
    await page.getByText('vault_array_b').click();

    // activate legacy object vault environment
    await page.getByLabel('Manage Environments').click();
    await page.getByText('legacy vault value object').click();
    await page.getByTestId('underlay').click();
    // activate request
    await page.getByTestId('legacy-object-vault').getByLabel('GET legacy-object-vault', { exact: true }).click();
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Console' }).click();
    await page.getByText('secv2').click();
    await page.getByText('password').click();
    await page.getByText('bar').click();
    await page.getByText('world').click();

    // activate invalid vault environment
    await page.getByLabel('Manage Environments').click();
    await page.getByText('base with vault').click();
    await page.getByTestId('underlay').click();
    // activate request
    await page.getByTestId('legacy-invalid-vault').getByLabel('GET legacy-invalid-vault', { exact: true }).click();
    await page.getByRole('button', { name: 'Send' }).click();    // Expect to see error message
    await expect(page.getByText('Unexpected Request Failure')).toBeVisible();
    await expect(page.getByText('vault is a reserved key for insomnia vault')).toBeVisible();
  });
});
