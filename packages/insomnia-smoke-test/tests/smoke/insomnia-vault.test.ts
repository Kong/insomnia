import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Test Insomnia Vault', async () => {

  test('check vault key display and can copy', async ({ page }) => {
    await page.locator('[data-testid="settings-button"]').click();
    await page.locator('text=Insomnia Preferences').first().click();
    // get text under div with data-testid="vault-key"
    const expectedVaultKeyValue = 'eyJhbGciOiJBMjU2R0NNIiwiZXh0Ijp0cnVlLCJrIjoia';
    const vaultKeyValue = await page.getByTestId('VaultKeyDisplayPanel').innerText();
    await expect(vaultKeyValue).toContain(expectedVaultKeyValue);
    await page.getByTitle('Copy Vault Key').click();
    // get clipboard content
    const handle = await page.evaluateHandle(() => navigator.clipboard.readText());
    const clipboardContent = await handle.jsonValue();
    await expect(clipboardContent).toContain(expectedVaultKeyValue);
  });

  // skip the flaky test and fix it later
  test.skip('create global private sub environment to store vaults', async ({ page, app }) => {
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
    // import request
    const requestColText = await loadFixture('vault-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), requestColText);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByText('Vault Collection').click();

    // activate global private vault environment
    await page.getByLabel('Manage Environments').click();
    await page.getByPlaceholder('Choose a global environment').click();
    await page.getByRole('option', { name: 'New Environment' }).click();
    await page.getByRole('option', { name: 'New Environment' }).click();
    await page.getByText('Base Environment1').click();
    await page.getByTestId('underlay').click();
    // activate request
    await page.getByTestId('normal').getByLabel('GET normal', { exact: true }).click();
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Console' }).click();
    await page.getByText('bar').click();
    await page.getByText('world').click();
    await page.waitForTimeout(1500);
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
    await page.locator('[data-testid="settings-button"]').click();
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
