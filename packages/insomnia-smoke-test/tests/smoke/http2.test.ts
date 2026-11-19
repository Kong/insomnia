import path from 'node:path';

import { expect } from '@playwright/test';

import { getFixturePath } from '../../playwright/paths';
import { test } from '../../playwright/test';

// How long to wait for an HTTP response to arrive in the UI after clicking Send
const RESPONSE_TIMEOUT = 10_000;
// How long to wait for dialogs to open/close and UI transitions to settle
const UI_TIMEOUT = 10_000;

// The smoke server exposes an HTTP/2-only listener on 4012: ALPN advertises h2
// alone, so a libcurl build without HTTP/2 support fails the handshake instead
// of falling back to HTTP/1.1. This is the end-to-end guard for the nghttp2
// dependency the Windows binaries are built against.
test('can send HTTP/2 requests', { tag: '@libcurl' }, async ({ page, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.getByTestId('response-pane');
  const certsDialog = page.getByRole('dialog');
  const certificatesFixturePath = getFixturePath('certificates');

  await insomnia.projectPage.importFixture('http2-collection.yaml');

  // Trust the smoke server's CA, otherwise the request fails before ALPN runs
  await page.getByRole('button', { name: 'Add Certificates' }).click();
  await certsDialog.waitFor({ state: 'visible', timeout: UI_TIMEOUT });

  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add CA Certificate' }).click();
  await (await fileChooser).setFiles(path.join(certificatesFixturePath, 'rootCA.pem'));
  await expect.soft(page.getByText('rootCA.pem')).toBeVisible({ timeout: UI_TIMEOUT });

  await page.getByRole('button', { name: 'Done' }).click();
  await certsDialog.waitFor({ state: 'hidden', timeout: UI_TIMEOUT });

  await insomnia.navigationSidebar.clickRequestOrFolder('HTTP/2 request');
  await expect
    .soft(page.getByTestId('request-pane').getByTestId('OneLineEditor').getByText('https://localhost:4012/pets/1'))
    .toBeVisible();

  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK', { timeout: RESPONSE_TIMEOUT });
  await expect.soft(responseBody).toContainText(/"id":\s*"1"/, { timeout: RESPONSE_TIMEOUT });
  // the body echoes the negotiated protocol, so this fails if the request
  // silently fell back to HTTP/1.1
  await expect.soft(responseBody).toContainText(/"httpVersion":\s*"2\.0"/, { timeout: RESPONSE_TIMEOUT });
});
