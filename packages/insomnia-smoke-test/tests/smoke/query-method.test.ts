import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('can select and send a QUERY request with a body', async ({ page, insomnia }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const statusTag = page.getByTestId('response-pane').getByTestId('response-status-tag');
  const responsePreviewBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible');

  // Create a collection and import a request that targets the echo endpoint with a body
  await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
  await insomnia.navigationSidebar.openWorkspaceActionsDropdown('My first collection');
  await page.getByRole('menuitemradio', { name: 'From Curl' }).click();
  await page
    .getByRole('dialog')
    .locator('.CodeMirror textarea')
    .fill(`curl --url http://127.0.0.1:4010/echo --data '{"search":"insomnia"}'`);
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await expect
    .soft(page.getByTestId('request-pane').getByTestId('OneLineEditor').getByText('http://127.0.0.1:4010/echo'))
    .toBeVisible();

  // Switch the method to the QUERY verb via the method picker
  await page.getByLabel('Request Method').click();
  await page.getByRole('button', { name: 'QUERY', exact: true }).click();
  await expect.soft(page.getByLabel('Request Method')).toContainText('QUERY');

  // Send and confirm the server received a QUERY request with the body intact
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responsePreviewBody).toContainText('"method": "QUERY"');
  await expect.soft(responsePreviewBody).toContainText('insomnia');
});
