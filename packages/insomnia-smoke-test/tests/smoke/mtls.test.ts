import path from 'node:path';

import { expect } from '@playwright/test';

import { getFixturePath, loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// How long to wait for an HTTP response to arrive in the UI after clicking Send
const RESPONSE_TIMEOUT = 10_000;
// How long to wait for dialogs to open/close and UI transitions to settle
const UI_TIMEOUT = 10_000;

test('can use client certificate for mTLS', async ({ app, page, insomnia }) => {
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });
  const certsDialog = page.getByRole('dialog');

  await page.getByTestId('settings-button').click();
  await page.getByTestId('dataFolders').fill(getFixturePath(path.join('certificates', 'client')));
  await page.getByTestId('dataFolders-btn').click();
  await expect.soft(page.getByText('client')).toBeVisible({ timeout: UI_TIMEOUT });
  await page.getByTestId('dataFolders').fill(getFixturePath(path.join('certificates', 'rootCA.pem')));
  await page.getByTestId('dataFolders-btn').click();
  await expect.soft(page.getByText('rootCA.pem')).toBeVisible({ timeout: UI_TIMEOUT });
  await page.locator('.app').press('Escape');
  // wait for settings dialog to fully close before continuing
  await page.getByTestId('settings-button').waitFor({ state: 'visible', timeout: UI_TIMEOUT });

  const clientCertsCollectionText = await loadFixture('client-certs.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), clientCertsCollectionText);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  // wait for the import dialog to close and collection to be available in the sidebar
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: UI_TIMEOUT });

  await insomnia.navigationSidebar.clickRequestOrFolder('pet 2 with url var');
  await expect.soft(insomnia.navigationSidebar.requestRow('pet 2 with url var').first()).toBeVisible({ timeout: UI_TIMEOUT });

  await page.getByRole('button', { name: 'Send', exact: true }).click();
  // SSL error is expected here — no CA cert yet
  await expect.soft(page.getByText('Error: SSL peer certificate or SSH remote key was not OK')).toBeVisible({ timeout: RESPONSE_TIMEOUT });

  const fixturePath = getFixturePath('certificates');

  await page.getByRole('button', { name: 'Add Certificates' }).click();
  await certsDialog.waitFor({ state: 'visible', timeout: UI_TIMEOUT });

  let fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add CA Certificate' }).click();
  await (await fileChooser).setFiles(path.join(fixturePath, 'rootCA.pem'));
  // verify CA cert row appears before dismissing the dialog
  await expect.soft(page.getByText('rootCA.pem')).toBeVisible({ timeout: UI_TIMEOUT });

  await page.getByRole('button', { name: 'Done' }).click();
  // wait for the certs dialog to close before sending
  await certsDialog.waitFor({ state: 'hidden', timeout: UI_TIMEOUT });

  await page.getByRole('button', { name: 'Send', exact: true }).click();
  // CA cert added but no client cert yet — server must reject with 401
  await expect.soft(statusTag).toContainText('401 Unauthorized', { timeout: RESPONSE_TIMEOUT });
  await expect.soft(responseBody).toContainText('Client certificate required', { timeout: RESPONSE_TIMEOUT });

  await page.getByRole('button', { name: 'Add Certificates' }).click();
  await certsDialog.waitFor({ state: 'visible', timeout: UI_TIMEOUT });
  await page.getByRole('button', { name: 'Add client certificate' }).click();
  await page.locator('[name="host"]').fill('localhost');

  fileChooser = page.waitForEvent('filechooser');
  await page.locator('[data-test-id="add-client-certificate-file-chooser"]').click();
  await (await fileChooser).setFiles(path.join(fixturePath, 'client.crt'));

  fileChooser = page.waitForEvent('filechooser');
  await page.locator('[data-test-id="add-client-certificate-key-file-chooser"]').click();
  await (await fileChooser).setFiles(path.join(fixturePath, 'client.key'));

  await page.getByRole('dialog').getByRole('button', { name: 'Add certificate' }).click();
  // verify the certificate row appears (hostname) before dismissing the dialog
  await expect.soft(page.getByText('localhost')).toBeVisible({ timeout: UI_TIMEOUT });

  await page.getByRole('button', { name: 'Done' }).click();
  // wait for the certs dialog to close before sending
  await certsDialog.waitFor({ state: 'hidden', timeout: UI_TIMEOUT });

  await page.getByRole('button', { name: 'Send', exact: true }).click();
  // both CA and client cert present — server must accept with 200
  await expect.soft(statusTag).toContainText('200 OK', { timeout: RESPONSE_TIMEOUT });
  await expect.soft(responseBody).toContainText('"id": "2"', { timeout: RESPONSE_TIMEOUT });

  // ensure disabling the cert actually disables it
  await page.getByRole('button', { name: 'Add Certificates' }).click();
  await certsDialog.waitFor({ state: 'visible', timeout: UI_TIMEOUT });
  const toggle = page.locator('[data-test-id="client-certificate-toggle"]');
  await toggle.click();
  // verify the toggle changed state before dismissing
  await expect.soft(toggle).toHaveAttribute('aria-pressed', 'false', { timeout: UI_TIMEOUT });

  await page.getByRole('button', { name: 'Done' }).click();
  // wait for the certs dialog to close before navigating
  await certsDialog.waitFor({ state: 'hidden', timeout: UI_TIMEOUT });

  await insomnia.navigationSidebar.clickRequestOrFolder('pet 2');
  await expect.soft(insomnia.navigationSidebar.requestRow('pet 2').first()).toBeVisible({ timeout: UI_TIMEOUT });
  // pet 2 has no prior response; wait for the pane to clear before sending
  await statusTag.waitFor({ state: 'hidden', timeout: UI_TIMEOUT });

  await page.getByRole('button', { name: 'Send', exact: true }).click();
  // client cert disabled — server must reject again with 401
  await expect.soft(statusTag).toContainText('401 Unauthorized', { timeout: RESPONSE_TIMEOUT });
  await expect.soft(responseBody).toContainText('Client certificate required', { timeout: RESPONSE_TIMEOUT });
});
