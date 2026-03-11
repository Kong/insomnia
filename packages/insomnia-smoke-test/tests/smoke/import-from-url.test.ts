import { expect } from '@playwright/test';

import { InsomniaApp } from '../../playwright/pages';
import { test } from '../../playwright/test';

test.describe('Import from URL', () => {
  test.beforeEach(async ({ insomnia }) => {
    await insomnia.projectPage.importFixture('import-from-url.yaml');
  });

  test('Should work as expected in HTTP request', async ({ page }) => {
    const requestUrl = 'http://localhost:4010/echo?foo=bar&baz=qux';
    const codeMirror = page.getByTestId('OneLineEditor').first().locator('.CodeMirror');
    await page.getByText('example http').click();

    const importFromUrlButton = page.getByRole('button', { name: 'Import from URL' });
    await importFromUrlButton.click();

    await expect
      .soft(codeMirror.locator('.CodeMirror-line').getByRole('presentation'))
      .toHaveText('http://localhost:4010/echo');

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify response
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    await expect.soft(statusTag).toContainText('200 OK');

    const responsePane = page.getByTestId('response-pane');
    await page.getByRole('tab', { name: 'Console' }).click();

    await expect.soft(responsePane).toContainText(requestUrl);
  });

  test('Should work as expected in Websocket request', async ({ page }) => {
    const requestUrl = 'ws://localhost:4010?foo=bar&baz=qux';
    const codeMirror = page.getByTestId('OneLineEditor').first().locator('.CodeMirror');

    await page.getByText('example websocket').click();

    const importFromUrlButton = page.getByRole('button', { name: 'Import from URL' });
    await importFromUrlButton.click();

    await expect
      .soft(codeMirror.locator('.CodeMirror-line').getByRole('presentation'))
      .toHaveText('ws://localhost:4010');

    // connect
    await page.getByTestId('request-pane').getByRole('button', { name: 'Connect' }).click();

    // verify response
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    await expect.soft(statusTag).toContainText('101 Switching Protocols');

    const responsePane = page.getByTestId('response-pane');
    await page.getByRole('tab', { name: 'Console' }).click();

    await expect.soft(responsePane).toContainText(requestUrl);
  });
});
