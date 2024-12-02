import path from 'node:path';

import { expect } from '@playwright/test';

import { getFixturePath, loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can send gRPC requests using mTLS requests (with reflection)', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  const text = await loadFixture('grpc-mtls.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByLabel('grpc').click();

  await page.getByLabel('Request Collection').getByTestId('grpcs').press('Enter');
  await expect(page.getByRole('button', { name: 'Select Method' })).toBeDisabled();

  // add root CA and client certificate
  const fixturePath = getFixturePath('certificates');

  await page.getByRole('button', { name: 'Add Certificates' }).click();
  let fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add CA Certificate' }).click();
  await (await fileChooserPromise).setFiles(path.join(fixturePath, 'rootCA.pem'));

  await page.getByRole('button', { name: 'Add client certificate' }).click();
  await page.locator('[name="host"]').fill('localhost');

  fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-test-id="add-client-certificate-file-chooser"]').click();
  await (await fileChooserPromise).setFiles(path.join(fixturePath, 'client.crt'));

  fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-test-id="add-client-certificate-key-file-chooser"]').click();
  await (await fileChooserPromise).setFiles(path.join(fixturePath, 'client.key'));

  await page.getByRole('button', { name: 'Add certificate' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // initiates an mtls connection with the given certificates
  await page.getByTestId('button-server-reflection').click();

  await page.getByRole('button', { name: 'Select Method' }).click();
  await page.getByRole('option', { name: 'RouteGuide/GetFeature' }).click();

  await page.getByRole('tab', { name: 'Unary' }).click();
  await page.getByRole('button', { name: 'Send' }).click();

  // Check for the single Unary response
  await page.getByRole('tab', { name: 'Response 1' }).click();
  await expect(statusTag).toContainText('0 OK');
  await expect(responseBody).toContainText('Berkshire Valley Management Area Trail');
});
