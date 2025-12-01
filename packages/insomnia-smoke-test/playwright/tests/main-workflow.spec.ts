import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

test('Main workflow: create, send and validate HTTP request', async ({ page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  // Create a new project
  await page.getByRole('button', { name: 'Create' }).click();
  const collectionName = 'My Collection';
  await page.getByRole('menuitem', { name: 'Request Collection' }).click();
  await page.locator('[data-testid="name-input"]').fill(collectionName);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText(collectionName).click();

  // Create a new HTTP request
  await page.getByTestId('sidebar-create-request-button').click();
  const requestName = 'Echo Request';
  await page.locator('[data-testid="name-input"]').fill(requestName);
  await page.getByRole('button', { name: 'Create' }).click();

  // Define and use environment variables
  await page.getByTestId('workspace-dropdown').click();
  await page.getByRole('menuitem', { name: 'Environments' }).click();
  await page.locator('.CodeMirror-line').click();
  await page.locator('textarea.CodeMirror-input').fill(`{
    "base_url": "http://127.0.0.1:4010",
    "path": "/echo",
    "api_key": "secret-key"
  }`);
  await page.getByText('New Environment').dblclick();
  await page.locator('input[value="New Environment"]').fill('Base Env');
  await page.locator('input[value="Base Env"]').press('Enter');
  await page.locator('.app').press('Escape');

  // Set request URL, method, body, and headers
  const urlEditor = page.getByTestId('request-pane').getByTestId('OneLineEditor');
  await urlEditor.click();
  await urlEditor.locator('textarea').fill('{{ base_url }}{{ path }}');
  await page.getByTestId('request-method-dropdown').click();
  await page.getByRole('option', { name: 'POST' }).click();
  await page.getByRole('tab', { name: 'Body' }).click();
  await page.getByTestId('body-type-dropdown').click();
  await page.getByRole('option', { name: 'JSON' }).click();
  await page.locator('.CodeMirror-line').click();
  await page.locator('textarea.CodeMirror-input').fill(`{
    "message": "hello-insomnia",
    "id": 123
  }`);
  await page.getByRole('tab', { name: 'Headers' }).click();
  await page.locator('[aria-label="Header Name"]').fill('X-API-Key');
  await page.locator('[aria-label="Header Value"]').fill('{{ api_key }}');

  // Send request and validate response
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.getByTestId('response-pane');
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"message": "hello-insomnia"');
  await expect(responseBody).toContainText('"x-api-key": "secret-key"');
});
