import { expect } from '@playwright/test';

import { getFixturePath, loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

const testVaultKey =
  'eyJhbGciOiJBMjU2R0NNIiwiZXh0Ijp0cnVlLCJrIjoiaEoxaW03cjcwV3ltZ3puT3hXcDNTb0ZQS3RBaGMwcmFfd2VQb2Z2b2xRNCIsImtleV9vcHMiOlsiZW5jcnlwdCIsImRlY3J5cHQiXSwia3R5Ijoib2N0In0=';
const testVaultSalt = 'e619272433fc739d52ff1ba1b45debedfe55cb42685af10a46e2b1285acb7120';
const tesSrpSecret = 'b424e8700ef89f77a6cffc648b9c6d42bb7de58914d88cd79966684ffe5b4ebe';

test('Check vault key generation', async ({ page }) => {
  await page.getByTestId('settings-button').click();
  await page.locator('text=Insomnia Preferences').first().click();
  // generate vault key
  await page.getByRole('button', { name: 'Generate Vault Key' }).click();
  const vaultKeyValue = await page.getByTestId('VaultKeyDisplayPanel').innerText();
  expect.soft(vaultKeyValue.length).toBeGreaterThan(0);
});

test.describe('Vault key actions', () => {
  test.use({
    userConfig: async ({ userConfig }, use) => {
      await use({
        ...userConfig,
        vaultSalt: testVaultSalt,
        vaultSrpSecret: tesSrpSecret,
      });
    },
  });

  test('check reset and validate vault key', async ({ page }) => {
    // check vault key validation
    await page.getByTestId('settings-button').click();
    await page.locator('text=Insomnia Preferences').first().click();
    // validate vault key
    await page.getByRole('button', { name: 'Enter Vault Key' }).click();
    const modal = page.getByTestId('input-vault-key-modal');
    await expect.soft(modal).toBeVisible();
    // fill the input with aria label test with valid and invalid vault key
    await page.getByLabel('Vault Key Input').fill('invalidVaultKey');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await modal.getByText('Invalid vault key, please check and input again').click();
    // test reset vault key
    await page.getByRole('dialog').getByText('Reset Vault Key').dblclick();
    await expect.soft(modal).toBeVisible();
    const vaultKeyValueInModal = await modal.getByTestId('VaultKeyDisplayPanel').innerText();
    expect.soft(vaultKeyValueInModal.length).toBeGreaterThan(0);
    await page.getByText('OK', { exact: true }).click();
    const vaultKeyValue = page.getByTestId('VaultKeyDisplayPanel');
    await expect.soft(vaultKeyValue).toHaveText(vaultKeyValueInModal);
  });

  test('check reset vault key in private environment', async ({ page, app }) => {
    // import global environment
    const vaultEnvText = await loadFixture('vault-environment.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), vaultEnvText);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByRole('dialog').getByText('Reset Vault Key').dblclick();
    const vaultKeyValueInModal = await page.getByTestId('VaultKeyDisplayPanel').innerText();
    expect.soft(vaultKeyValueInModal.length).toBeGreaterThan(0);
  });
});

test.describe('Check vault used in environment', () => {
  test.use({
    userConfig: async ({ userConfig }, use) => {
      await use({
        ...userConfig,
        vaultKey: testVaultKey,
        vaultSalt: testVaultSalt,
      });
    },
  });

  test('global private sub environment to store vaults', async ({ page, app, insomnia }) => {
    await page.getByTestId('settings-button').click();
    await page.getByTestId('dataFolders').fill(getFixturePath('vault-collection.yaml'));
    await page.getByTestId('dataFolders-btn').click();
    await page.locator('.app').press('Escape');

    // import global environment
    const vaultEnvText = await loadFixture('vault-environment.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), vaultEnvText);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    // go back
    await page.getByTestId('workspace-breadcrumb-level-0').click();

    // create new global private environment
    await page.getByLabel('Create in project').click();
    await page.getByLabel('Create', { exact: true }).getByText('Environment').click();
    await page.getByPlaceholder('Enter a name for your Environment').fill('New Global Vault Environment');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByTestId('CreateEnvironmentDropdown').click();
    await page.getByText('Private environment').click();
    // activate created private environment
    await page.getByRole('grid', { name: 'Environments' }).getByText('New Environment').click();

    const kvTable = page.getByRole('listbox', { name: 'Environment Key Value Pair' });

    // add first secret environment
    const firstRow = kvTable.getByRole('option').first();
    const firstKey = firstRow.getByTestId('OneLineEditor').first();
    await firstKey.click();
    await page.keyboard.type('foo');
    await expect.soft(firstKey).toContainText('foo');
    // Convert the row to Secret *before* entering the value, then type the secret directly into the
    // revealed editor. Converting a just-typed string to Secret races the async persistence
    // round-trip (the editor's change goes through a fetcher submit + revalidation): the typed value
    // may not be committed yet when the conversion reads it, so an empty string gets encrypted and the
    // revealed secret comes back blank. Typing into the already-Secret field encrypts each keystroke,
    // so there is no stale value to read.
    await firstRow.getByRole('button', { name: 'Type Selection' }).click({ delay: 200 });
    await page.getByRole('menuitemradio', { name: 'Secret' }).click();
    await expect.soft(firstRow.locator('.fa-eye-slash')).toBeVisible();
    // reveal the secret editor and type the value into it
    await firstRow.locator('.fa-eye-slash').click();
    const firstValue = firstRow.getByTestId('OneLineEditor').nth(1);
    await firstValue.click({ delay: 200 });
    await page.keyboard.type('bar');
    // test the secret value is shown decrypted in the UI
    await expect.soft(firstValue).toContainText('bar');

    // add second secret environment (same order as above: convert to Secret first, then type the value)
    await page.getByRole('button', { name: 'Add Row' }).click();
    const secondRow = kvTable.getByRole('option').nth(1);
    const secondKey = secondRow.getByTestId('OneLineEditor').first();
    await secondKey.click();
    await page.keyboard.type('hello');
    await expect.soft(secondKey).toContainText('hello');
    await secondRow.getByRole('button', { name: 'Type Selection' }).click({ delay: 200 });
    await page.getByRole('menuitemradio', { name: 'Secret' }).click();
    await expect.soft(secondRow.locator('.fa-eye-slash')).toBeVisible();
    await secondRow.locator('.fa-eye-slash').click();
    const secondValue = secondRow.getByTestId('OneLineEditor').nth(1);
    await secondValue.click({ delay: 200 });
    await page.keyboard.type('world');
    await expect.soft(secondValue).toContainText('world');

    // go back
    await page.getByTestId('workspace-breadcrumb-level-0').click();

    // import requests
    const requestColText = await loadFixture('vault-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), requestColText);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    // activate existing global private vault environment from import
    await page.getByLabel('Manage Environments').click();
    await page.getByPlaceholder('Choose a project environment').click();
    await page.getByRole('option', { name: 'New Global Vault Environment' }).click();
    await page.getByRole('option', { name: 'New Environment' }).click();
    await page.getByText('Base Environment1').click();
    await page.locator('body').click();

    // activate request and validate newly created vault env has been applied
    await insomnia.navigationSidebar.clickRequestOrFolder('normal');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200');
    await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
    await page.getByText('bar').click();
    await page.getByText('world').click();

    // allow vault to be accessed by the request
    await page.getByTestId('settings-button').click();
    await page.locator('text=Insomnia Preferences').first().click();
    await page.locator('text=Enable vault in scripts').click();
    await page.locator('.app').press('Escape');

    // activate global private vault environment from import
    await page.getByLabel('Manage Environments').click();
    await page.getByPlaceholder('Choose a project environment').click();
    await page.getByRole('option', { name: 'Global env workspace with secret vault' }).click();
    await page.getByText('global vault env with secret').click();

    // activate legacy array vault environment
    await page.getByText('legacy vault value array').click();
    await page.locator('body').click();
    // activate request
    await insomnia.navigationSidebar.requestRow('legacy-array-vault').click({
      modifiers: ['ControlOrMeta'],
    });

    // Wait for tab appear
    await expect.soft(page.getByLabel('Insomnia Tabs').getByText('legacy-array-vault', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Send' }).click();
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200');
    await page.getByRole('tab', { name: 'Console' }).click();
    await page.getByText('password').click();
    await page.getByText('bar').click();
    await page.getByText('world').click();
    await page.getByText('vault_array_a').click();
    await page.getByText('vault_array_b').click();

    // activate legacy object vault environment
    await page.getByLabel('Manage Environments').click();
    await page.getByText('legacy vault value object').click();
    await page.locator('body').click();
    // activate request
    await insomnia.navigationSidebar.requestRow('legacy-object-vault').click({
      modifiers: ['ControlOrMeta'],
    });
    await expect.soft(page.getByLabel('Insomnia Tabs').getByText('legacy-object-vault', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Send' }).click();
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200');

    await page.getByRole('tab', { name: 'Console' }).click();
    await page.getByText('secv2').click();
    await page.getByText('password').click();
    await page.getByText('bar').click();
    await page.getByText('world').click();

    // activate invalid vault environment
    await page.getByLabel('Manage Environments').click();
    await page.getByText('base with vault').click();
    await page.locator('body').click();
    // activate request
    await insomnia.navigationSidebar.requestRow('legacy-invalid-vault').click({
      modifiers: ['ControlOrMeta'],
    });
    await expect
      .soft(page.getByLabel('Insomnia Tabs').getByText('legacy-invalid-vault', { exact: true }))
      .toBeVisible();
    await page.getByRole('button', { name: 'Send' }).click(); // Expect to see error message
    await expect.soft(page.getByText('Unexpected Request Failure')).toBeVisible();
    await expect.soft(page.getByText('Error: vault is a reserved')).toBeVisible();
  });
});
