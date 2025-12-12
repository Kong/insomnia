import { expect } from '@playwright/test';
import { test } from '../../playwright/test';

// Main workflow: create, send, and validate a request

test.describe('after-response script features tests', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('main workflow: create, send, and validate a request', async ({ app, page }) => {
    // Open the app and ensure dashboard is loaded
    await expect(page.locator('.app')).toBeVisible();

    // Create a new request collection
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    await page.getByRole('tab', { name: 'Body' }).click();
    await page.getByRole('button', { name: 'Body' }).click();
    await page.getByRole('option', { name: 'JSON' }).click();

    // Fill in the request URL
    await page.getByTestId('request-pane').locator('.CodeMirror textarea').first().fill('http://127.0.0.1:4010/echo');

    const bodyEditor = page.getByTestId('CodeEditor').getByRole('textbox');
    await bodyEditor.fill('{“aa”:123}');

    // Send the request
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // Validate the response status and body
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    await expect.soft(statusTag).toContainText('200 OK');
    await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
    await page.locator('.cm-curl-data', { hasText: '{“aa”:123}' }).click();
  });

  // Additional scenario: Send request with cookie
  test('main workflow: send request with cookie', async ({ page }) => {
    // Open the app and ensure dashboard is loaded
    await expect(page.locator('.app')).toBeVisible();
    // Create a new request collection
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    await page.getByTestId('request-pane').locator('.CodeMirror textarea').first().fill('http://localhost:4010/pets/1');

    // Open cookie editor
    await page.click('button:has-text("Cookies")');

    // Create a new cookie

    await page.getByRole('dialog').getByRole('button', { name: 'Add Cookie' }).click();

    // Edit the new cookie
    await page.getByRole('listbox').getByRole('button', { name: 'Edit' }).first().click();
    await page.getByText('HostOnly').click();
    await expect.soft(page.locator('input[name="hostOnly"]')).toBeChecked();
    await page.getByRole('tab', { name: 'Raw' }).click();
    await page
      .locator('text=Raw Cookie String >> input[type="text"]')
      .fill('__Host-foo=bar; Expires=Tue, 19 Jan 2038 03:14:07 GMT; Secure; Domain=localhost; Path=/');
    await page.locator('text=Done').nth(1).click();
    await page.click('text=Done');

    // Send request
    await page.click('[data-testid="request-pane"] button:has-text("Send")');

    // Check in the timeline that the cookie was sent
    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(page.getByText('__Host-foo=bar')).toBeVisible();
  });

  // Additional scenario: Send request with missing URL and expect error

  test('main workflow: send request with missing URL shows error', async ({ page }) => {
    // Open the app and ensure dashboard is loaded
    await expect(page.locator('.app')).toBeVisible();

    // Create a new request collection
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
    await page.getByLabel('Create in collection').click();
    await page.getByLabel('HTTP Request').click();
    await page.getByTestId('New Request').getByLabel('GET New Request', { exact: true }).click();

    await page.getByLabel('Request Method').click();
    await page.getByRole('button', { name: 'POST' }).click();

    // Leave URL empty and send
    await page.getByTestId('request-pane').locator('.CodeMirror textarea').first().fill('');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // Validate error message
    await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
    await page.getByText('No URL set').click();
  });

  // Additional scenario: Send request with authentication

  test('main workflow: send request with basic authentication', async ({ page }) => {
    // Open the app and ensure dashboard is loaded
    await expect(page.locator('.app')).toBeVisible();

    // Create a new request collection
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();
    // Fill in the request URL
    await page.getByTestId('request-pane').locator('.CodeMirror textarea').first().fill('http://127.0.0.1:4010/echo');

    // Set basic auth (assuming UI has a way to set it)
    await page.getByRole('tab', { name: 'Auth' }).click({ delay: 200 });
    await page.getByRole('button', { name: 'Auth' }).click();
    await page.getByLabel('Basic', { exact: true }).click();

    // Send the request
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // Validate the response
    await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
    await page.getByText('Authorization: Basic Og==').click();
  });

  // Additional scenario: Switch environment and send request

  test('main workflow: switch environment and send request', async ({ page }) => {
    // Open the app and ensure dashboard is loaded
    await expect(page.locator('.app')).toBeVisible();

    // Create a new request collection
    await page.getByRole('button', { name: 'Create request collection', exact: true }).click();

    // Switch environment
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();

    const kvTable = page.getByRole('listbox', { name: 'Environment Key Value Pair' });
    await page.getByRole('dialog').getByRole('button', { name: 'Delete All' }).dblclick();
    // check items have been deleted
    await expect.soft(kvTable.getByRole('option').nth(2)).toBeHidden();

    let firstRow = kvTable.getByRole('option').first();
    await firstRow.getByTestId('OneLineEditor').first().click();
    await page.keyboard.type('base_url');
    await firstRow.getByTestId('OneLineEditor').nth(1).click({ delay: 200 });
    await page.keyboard.type('http://127.0.0.1:4010');

    await page.getByRole('button', { name: 'Close', exact: true }).click({ delay: 200 });

    // Fill in the request URL with environment variable
    await page.getByRole('option', { name: 'Base Environment' }).press('Enter');
    await page.getByRole('option', { name: 'Base Environment' }).press('Escape');
    await page.getByTestId('request-pane').locator('.CodeMirror textarea').first().fill('{{base_url}}/echo');

    // Send the request
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click({ delay: 200 });

    // Validate error message
    await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
    await page.getByText('Host: 127.0.0.1:4010').click();
  });
});
