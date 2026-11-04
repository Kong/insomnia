import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

/**
 * Core Workflow Tests
 *
 * Covers the primary end-to-end Insomnia workflows:
 *   1. Sending a GET request with environment-variable URL substitution
 *   2. Creating a resource via POST and verifying the 201 response
 *   3. Full CRUD chain: POST to create → after-response script captures ID → GET retrieves item
 *   4. Custom request headers propagated and reflected in an echo response
 *   5. Basic authentication applied to a protected endpoint
 *   6. Creating a new HTTP request manually from the UI and sending it
 *
 * Mock server endpoints used (all in packages/insomnia-smoke-test/server/):
 *   GET  /pets/:id          → 200 { id }
 *   POST /simple-crud       → 201 { id, ...body }
 *   GET  /simple-crud/:id   → 200 { id, ...body } | 404
 *   POST /echo              → 200 { method, headers, data, cookies }
 *   GET  /auth/basic        → 200 (requires Basic user:pass)
 */

test.describe('Core Workflow', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test.beforeEach(async ({ app, page }) => {
    const text = await loadFixture('core-workflow.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  });

  // ─── 1. GET with environment-variable substitution ────────────────────────

  test('sends GET request with env var substitution and verifies JSON response', async ({ page }) => {
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responsePane = page.getByTestId('response-pane');

    // Select the request and send it
    await page.getByLabel('Request Collection').getByTestId('get pet by id').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // Status: 200 OK
    await expect.soft(statusTag).toContainText('200 OK');

    // Body: { "id": "42" } — pet_id env var resolved to "42"
    await expect.soft(responsePane).toContainText('"id"');
    await expect.soft(responsePane).toContainText('"42"');

    // Response Headers: content-type should be application/json
    await responsePane.getByRole('tab', { name: 'Headers' }).click();
    await expect.soft(responsePane).toContainText('content-type');
  });

  // ─── 2. POST → 201 Created ────────────────────────────────────────────────

  test('creates resource via POST and verifies 201 Created with body', async ({ page }) => {
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responsePane = page.getByTestId('response-pane');

    await page.getByLabel('Request Collection').getByTestId('create item').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // Status: 201 Created
    await expect.soft(statusTag).toContainText('201');

    // Body includes the server-assigned id and the payload we sent
    await expect.soft(responsePane).toContainText('"id"');
    await expect.soft(responsePane).toContainText('"Widget"');
    await expect.soft(responsePane).toContainText('9.99');

    // After-response script assertions are visible in the Tests tab
    await responsePane.getByRole('tab', { name: 'Tests' }).click();
    const testRows = page.getByTestId('test-result-row');
    await expect.soft(testRows.nth(0)).toContainText('PASS');
    await expect.soft(testRows.nth(1)).toContainText('PASS');
  });

  // ─── 3. Full CRUD chain: POST create → GET retrieve ───────────────────────

  test('performs full CRUD workflow: creates then retrieves resource', async ({ page }) => {
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responsePane = page.getByTestId('response-pane');

    // Step 1: Create – after-response script sets item_id in the environment
    await page.getByLabel('Request Collection').getByTestId('create item').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    await expect.soft(statusTag).toContainText('201');

    // Step 2: Retrieve – URL uses {{_.item_id}} injected by the script above
    await page.getByLabel('Request Collection').getByTestId('get created item').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // Status: 200 OK
    await expect.soft(statusTag).toContainText('200 OK');

    // Body must contain the data we originally POSTed
    await expect.soft(responsePane).toContainText('"Widget"');
    await expect.soft(responsePane).toContainText('9.99');
  });

  // ─── 4. Custom request headers reflected in echo response ─────────────────

  test('sends POST with custom headers and verifies echo response', async ({ page }) => {
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responsePane = page.getByTestId('response-pane');

    await page.getByLabel('Request Collection').getByTestId('echo with custom header').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // Status: 200 OK
    await expect.soft(statusTag).toContainText('200 OK');

    // Echo server mirrors the HTTP method back in the body
    await expect.soft(responsePane).toContainText('"POST"');

    // Our custom header value must appear in the echoed headers object
    await expect.soft(responsePane).toContainText('insomnia-rocks');

    // The request body is also echoed under the "data" key
    await expect.soft(responsePane).toContainText('"workflow"');
  });

  // ─── 5. Basic authentication ──────────────────────────────────────────────

  test('sends authenticated request and verifies 200 OK', async ({ page }) => {
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');

    await page.getByLabel('Request Collection').getByTestId('authenticated request').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // The basic-auth endpoint returns 200 only when credentials are valid
    await expect.soft(statusTag).toContainText('200 OK');
  });

  // ─── 6. Create new HTTP request from scratch via the UI ───────────────────

  test('creates a new HTTP request from the UI, sets a URL, and sends it', async ({ page }) => {
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responsePane = page.getByTestId('response-pane');

    // Create a new blank HTTP request inside the collection
    await page.getByLabel('Create in collection').click();
    await page.getByRole('menuitemradio', { name: 'Http Request' }).click();

    // The new request row should be selected and the request pane visible
    const newRequest = page.getByLabel('Request Collection').getByRole('row', { name: 'New Request' }).first();
    await expect.soft(newRequest.locator('[data-selected="true"]').first()).toBeVisible();

    // Enter a URL in the URL bar (OneLineEditor at the top of the request pane)
    const urlBar = page.getByTestId('request-pane').getByTestId('OneLineEditor').first().getByRole('textbox');
    await urlBar.click();
    await page.keyboard.type('http://127.0.0.1:4010/pets/99');
    await page.keyboard.press('Tab');

    // Send the request
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // Status: 200 OK
    await expect.soft(statusTag).toContainText('200 OK');

    // The mock server echoes back the path parameter as the id
    await expect.soft(responsePane).toContainText('"id"');
    await expect.soft(responsePane).toContainText('"99"');
  });

  // ─── 7. Environment switching changes the resolved URL ────────────────────

  test('switches to Staging environment and sends GET with different pet_id', async ({ page }) => {
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responsePane = page.getByTestId('response-pane');

    // Switch the active sub-environment to "Staging" (pet_id = "1")
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('option', { name: 'Staging' }).press('Enter');
    await page.getByRole('option', { name: 'Staging' }).press('Escape');

    // Send the same GET /pets/{{pet_id}} request
    await page.getByLabel('Request Collection').getByTestId('get pet by id').press('Enter');
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // Status: 200 OK
    await expect.soft(statusTag).toContainText('200 OK');

    // pet_id from the Staging env is "1", not the base env "42"
    await expect.soft(responsePane).toContainText('"1"');
  });
});
