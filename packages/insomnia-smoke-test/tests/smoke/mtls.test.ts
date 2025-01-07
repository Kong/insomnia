
import path from 'node:path';

import { expect } from '@playwright/test';

import { getFixturePath, loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can use client certificate for mTLS', async ({ app, page }) => {
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  const clientCertsCollectionText = await loadFixture('client-certs.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), clientCertsCollectionText);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByLabel('client-certs').click();

  await page.getByLabel('Request Collection').getByTestId('pet 2 with url var').press('Enter');

  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByText('Error: SSL peer certificate or SSH remote key was not OK').click();

  const fixturePath = getFixturePath('certificates');

  await page.getByRole('button', { name: 'Add Certificates' }).click();

  let fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add CA Certificate' }).click();
  await (await fileChooser).setFiles(path.join(fixturePath, 'rootCA.pem'));

  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(statusTag).toContainText('401 Unauthorized');
  await expect(responseBody).toContainText('Client certificate required');

  await page.getByRole('button', { name: 'Add Certificates' }).click();
  await page.getByRole('button', { name: 'Add client certificate' }).click();
  await page.locator('[name="host"]').fill('localhost');

  fileChooser = page.waitForEvent('filechooser');
  await page.locator('[data-test-id="add-client-certificate-file-chooser"]').click();
  await (await fileChooser).setFiles(path.join(fixturePath, 'client.crt'));

  fileChooser = page.waitForEvent('filechooser');
  await page.locator('[data-test-id="add-client-certificate-key-file-chooser"]').click();
  await (await fileChooser).setFiles(path.join(fixturePath, 'client.key'));

  await page.getByRole('button', { name: 'Add certificate' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"id": "2"');

  // ensure disabling the cert actually disables it
  await page.getByRole('button', { name: 'Add Certificates' }).click();
  await page.locator('[data-test-id="client-certificate-toggle"]').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByLabel('Request Collection').getByTestId('pet 2').press('Enter');

  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(statusTag).toContainText('401 Unauthorized');
  await expect(responseBody).toContainText('Client certificate required');

});
