import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('can send requests', async ({ page, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const statusTag = page.getByTestId('response-pane').getByTestId('response-status-tag');
  const responseBody = page.getByTestId('response-pane');
  const responsePreviewBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible');

  await insomnia.projectPage.importFixture('smoke-test-collection.yaml');

  await insomnia.navigationSidebar.openWorkspaceActionsDropdown('Smoke tests');
  await page.getByRole('menuitemradio', { name: 'Export' }).click();
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByText('Which format would you like to export as?').click();
  await insomnia.pressEscape();

  await insomnia.navigationSidebar.openWorkspaceActionsDropdown('Smoke tests');
  await page.getByRole('menuitemradio', { name: 'From Curl' }).click();
  await page.locator('.CodeMirror textarea').fill('curl --request GET --url http://127.0.0.1:4010/echo');
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await expect
    .soft(page.getByTestId('request-pane').getByTestId('OneLineEditor').getByText(`http://127.0.0.1:4010/echo`))
    .toBeVisible();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');

  await insomnia.navigationSidebar.clickRequestOrFolder('send JSON request');
  await expect
    .soft(page.getByTestId('request-pane').getByTestId('OneLineEditor').getByText(`http://127.0.0.1:4010/pets/1`))
    .toBeVisible();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responsePreviewBody).toContainText('"id": "1"');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  await expect.soft(responsePreviewBody).toContainText('{"id":"1"}');

  await insomnia.navigationSidebar.clickRequestOrFolder('connects to event stream and shows ping response');
  await expect
    .soft(page.getByTestId('request-pane').getByTestId('OneLineEditor').getByText(`http://127.0.0.1:4010/events`))
    .toBeVisible();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Connect' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
  await expect.soft(responseBody).toContainText('Connected to 127.0.0.1');
  await page.getByTestId('request-pane').getByRole('button', { name: 'Disconnect' }).click();

  await insomnia.navigationSidebar.clickRequestOrFolder('sends dummy.csv request and shows rich response');
  await expect
    .soft(
      page.getByTestId('request-pane').getByTestId('OneLineEditor').getByText(`http://127.0.0.1:4010/file/dummy.csv`),
    )
    .toBeVisible();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  await expect.soft(responsePreviewBody).toContainText('a,b,c');

  await insomnia.navigationSidebar.clickRequestOrFolder('sends dummy.xml request and shows raw response');
  await expect
    .soft(
      page.getByTestId('request-pane').getByTestId('OneLineEditor').getByText(`http://127.0.0.1:4010/file/dummy.xml`),
    )
    .toBeVisible();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responsePreviewBody).toContainText('xml version="1.0"');
  await expect.soft(responsePreviewBody).toContainText('<LoginResult>');

  await insomnia.navigationSidebar.clickRequestOrFolder('sends dummy.pdf request and shows rich response');
  await expect
    .soft(
      page.getByTestId('request-pane').getByTestId('OneLineEditor').getByText(`http://127.0.0.1:4010/file/dummy.pdf`),
    )
    .toBeVisible();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');

  const pdfIframe = page.getByTestId('ResponsePDFView');
  await expect.soft(pdfIframe).toBeVisible();
  await expect.soft(pdfIframe).toHaveAttribute('src', /^blob:/);

  // find Electron/Chromium's built-in PDF viewer extension
  await expect
    .poll(() => page.frames().some(f => f.url().startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai')), {
      timeout: 5000,
      message: 'Expected Chromium built-in PDF viewer extension frame to mount inside the PDF preview iframe',
    })
    .toBe(true);

  // No explicit timeout — inherits the global expect.timeout (40s on CI) so Playwright
  // retries long enough for the Chromium PDF viewer to finish rendering.
  await expect.soft(pdfIframe).toHaveScreenshot('dummy-pdf-preview.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.15,
  });

  await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
  await page.locator('pre').filter({ hasText: '< Content-Type: application/pdf' }).click();
  await page.getByTestId('response-pane').getByRole('tab', { name: 'Preview' }).click();

  await insomnia.navigationSidebar.clickRequestOrFolder('sends request with basic authentication');
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await page.getByTestId('response-pane').getByRole('tab', { name: 'Preview' }).click();
  await expect.soft(responsePreviewBody).toContainText('basic auth received');

  await insomnia.navigationSidebar.clickRequestOrFolder('sends request with cookie and get cookie in response');
  await expect
    .soft(page.getByTestId('request-pane').getByTestId('OneLineEditor').getByText(`http://127.0.0.1:4010/cookies`))
    .toBeVisible();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
  await expect.soft(responseBody).toContainText('Set-Cookie: insomnia-test-cookie=value123');

  await insomnia.navigationSidebar.clickRequestOrFolder('delayed request');
  await expect
    .soft(
      page.getByTestId('request-pane').getByTestId('OneLineEditor').getByText(`http://127.0.0.1:4010/delay/seconds/20`),
    )
    .toBeVisible();
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

  await page.getByRole('button', { name: 'Cancel Request' }).click();
  await page.getByText('Request was cancelled').click();
});
