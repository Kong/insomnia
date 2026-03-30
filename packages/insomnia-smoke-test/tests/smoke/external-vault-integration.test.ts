import { expect } from '@playwright/test';

import { getFixturePath, loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('Setup external vault and used in request', async ({ app, page }) => {
  // import request collection and replace the template tag file path with the actual fixture file path
  const text = (await loadFixture('template-tag-collection.yaml')).replace(
    '__TEMPLATE_TAG_FILE_PATH',
    getFixturePath('files/template-file.txt'),
  );
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  // Nav to cloud credentials page
  await page.getByTestId('settings-button').click();
  await page.getByRole('tab', { name: 'Credentials' }).click();
  // create aws credential
  const awsCredentialName = 'smoke-test-aws';
  await page.getByRole('button', { name: 'Create Cloud Credential' }).click();
  await page.getByRole('menuitemradio', { name: 'AWS' }).click();
  await page.getByRole('textbox', { name: 'Credential Name:' }).fill(awsCredentialName);
  await page.getByRole('radio', { name: 'Credential File' }).check();
  await page.getByRole('textbox', { name: 'Section Name:' }).fill('aws-section-name');
  await page.getByRole('textbox', { name: 'Region:' }).fill('aws-region');
  await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
  await expect.soft(page.getByRole('cell', { name: awsCredentialName })).toBeVisible();
  // create gcp credential
  const gcpCredentialName = 'smoke-test-gcp';
  await page.getByRole('button', { name: 'Create Cloud Credential' }).click();
  await page.getByRole('menuitemradio', { name: 'GCP' }).click();
  await page.getByRole('textbox', { name: 'Credential Name:' }).fill(gcpCredentialName);
  await page.getByRole('textbox', { name: 'Input Service Account Key Path' }).fill('gcp-path');
  await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
  await expect.soft(page.getByRole('cell', { name: gcpCredentialName })).toBeVisible();
  // create hashicorp credential
  const hashicorpCredentialName = 'smoke-test-hashicorp';
  await page.getByRole('button', { name: 'Create Cloud Credential' }).click();
  await page.getByRole('menuitemradio', { name: 'HashiCorp' }).click();
  await page.getByRole('textbox', { name: 'Credential Name:' }).fill(hashicorpCredentialName);
  await page.getByRole('textbox', { name: 'Server Address:' }).fill('http://127.0.0.1');
  await page.getByRole('textbox', { name: 'Role Id:' }).fill('role-id');
  await page.getByRole('textbox', { name: 'Secret Id:' }).fill('secret-id');
  await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
  await expect.soft(page.getByRole('cell', { name: hashicorpCredentialName })).toBeVisible();
  // test azure credential should open new browser window with correct url
  // Replace shell.openExternal
  await app.evaluate(({ shell }) => {
    shell.openExternal = async url => {
      // @ts-expect-error -- add url to globalThis to verify the url in test
      globalThis.__lastOpenedExternalUrl = url;
      return;
    };
  });
  await page.getByRole('button', { name: 'Create Cloud Credential' }).click();
  await page.getByRole('menuitemradio', { name: 'Azure' }).click();
  await page.getByText('Authenticate With Azure').first().click();
  // @ts-expect-error -- add url to globalThis to verify the url in test
  const azureAuthUrl = await app.evaluate(() => globalThis.__lastOpenedExternalUrl);
  expect.soft(azureAuthUrl).toContain('https://login.microsoftonline.com/');
  await page.locator('#close-add-cloud-credential-modal').click();

  // close the settings
  await page.locator('.app').press('Escape');

  // used in request
  await page.getByLabel('Request Collection').getByTestId('External Vault Tag').press('Enter');
  await page.getByText('Body', { exact: true }).click();
  const externalVaultTestCases = {
    aws: {
      tagPrefix: "{% vault 'aws'",
      expectedResult: 'aws-secret-value',
    },
    gcp: {
      tagPrefix: "{% vault 'gcp'",
      expectedResult: 'gcp-secret-value',
    },
    hashicorp: {
      tagPrefix: "{% vault 'hashicorp'",
      expectedResult: 'hashicorp-secret-value',
    },
  };
  // test aws vault tag
  await page.locator(`[data-template^="${externalVaultTestCases.aws.tagPrefix}"]`).click();
  await page.getByLabel('Credential For Vault Service').selectOption(awsCredentialName);
  const previewText = page.getByRole('dialog').getByLabel('Live Preview');
  await expect.soft(previewText).toHaveText(externalVaultTestCases.aws.expectedResult);
  await page.getByRole('button', { name: 'Done' }).click();
  // test gcp vault tag
  await page.locator(`[data-template^="${externalVaultTestCases.gcp.tagPrefix}"]`).click();
  await page.getByLabel('Credential For Vault Service').selectOption(gcpCredentialName);
  const gcpPreviewText = page.getByRole('dialog').getByLabel('Live Preview');
  await expect.soft(gcpPreviewText).toHaveText(externalVaultTestCases.gcp.expectedResult);
  await page.getByRole('button', { name: 'Done' }).click();
  // test hashicorp vault tag
  await page.locator(`[data-template^="${externalVaultTestCases.hashicorp.tagPrefix}"]`).click();
  await page.getByLabel('Credential For Vault Service').selectOption(hashicorpCredentialName);
  const hashicorpPreviewText = page.getByRole('dialog').getByLabel('Live Preview');
  await expect.soft(hashicorpPreviewText).toHaveText(externalVaultTestCases.hashicorp.expectedResult);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByText('Params', { exact: true }).click();
  await page.getByText('Body', { exact: true }).click();
  // send request
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await page.getByRole('tab', { name: 'Console' }).click();
  const responsePane = page.getByTestId('response-pane');
  await expect.soft(responsePane).toContainText(externalVaultTestCases.aws.expectedResult);
  await expect.soft(responsePane).toContainText(externalVaultTestCases.gcp.expectedResult);
  await expect.soft(responsePane).toContainText(externalVaultTestCases.hashicorp.expectedResult);
  // enable elevated access and execute again in renderer process
  await page.getByTestId('settings-button').click();
  await page.getByRole('tab', { name: 'Plugins' }).click();
  await page.getByText('Allow elevated access for plugins').click();
  // close the settings
  await page.locator('.app').press('Escape');
  // send request and execute the tags in renderer process
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await page.getByRole('tab', { name: 'Console' }).click();
  await expect.soft(responsePane).toContainText(externalVaultTestCases.aws.expectedResult);
});
