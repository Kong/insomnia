import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can render schema and send GraphQL requests', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  // Copy the collection with the graphql query to clipboard
  const text = await loadFixture('graphql.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  // Import from clipboard
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByLabel('Smoke GraphQL').click();

  // Open the graphql request
  await page.getByLabel('Request Collection').getByTestId('GraphQL request').press('Enter');
  await page.getByRole('tab', { name: 'Body' }).click();
  // Assert the schema is fetched after switching to GraphQL request
  await expect(page.getByText('Schema fetched just now')).toBeVisible();

  // Assert schema documentation stuff
  await page.getByRole('button', { name: 'schema' }).click();
  await page.getByRole('menuitem', { name: 'Show Documentation' }).click();
  await page.click('a:has-text("Query")');
  await page.locator('a:has-text("RingBearer")').click();
  const graphqlExplorer = page.locator('.graphql-explorer');
  await expect(graphqlExplorer).toContainText('Characters who at any time bore a Ring of Power.');
  await page.click('text=QueryRingBearer >> button');

  // Send and assert GraphQL request
  await page.click('[data-testid="request-pane"] >> text=Send');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  await expect(statusTag).toContainText('200 OK');

  // Export GraphQL request
  await page.getByText('GraphQL request with number').click();
  await page.getByTestId('Dropdown-GraphQL-request-with-number').click();

  await page.getByText('Copy as cURL').click();
  const handle = await page.evaluateHandle(() => navigator.clipboard.readText());
  const clipboardContent = await handle.jsonValue();
  const exepctResult = JSON.stringify({ query: 'query($inputVar:Int){echoNum(intVar:$inputVar)}', variables: { inputVar: 3 } });
  // expect exported curl body to be JSON string
  expect(clipboardContent.split('--data ')[1]?.replace(/[\n\s\']/g, '')).toContain(exepctResult);

  await page.getByRole('button', { name: 'Send' }).click();

  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  await expect(responseBody).toContainText('"echoNum": 777');
});

test('can render schema and send GraphQL requests with object variables', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  // Copy the collection with the graphql query to clipboard
  const text = await loadFixture('graphql.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  // Import from clipboard
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByLabel('Smoke GraphQL').click();

  // Open the graphql request
  await page.getByLabel('Request Collection').getByTestId('GraphQL request with variables').press('Enter');
  await page.getByRole('tab', { name: 'Body' }).click();
  // Assert the schema is fetched after switching to GraphQL request
  await expect(page.getByText('Schema fetched just now')).toBeVisible();

  // Assert schema documentation stuff
  await page.getByRole('button', { name: 'schema' }).click();
  await page.getByRole('menuitem', { name: 'Show Documentation' }).click();
  await page.click('a:has-text("Query")');
  await page.locator('a:has-text("RingBearer")').click();
  const graphqlExplorer2 = page.locator('.graphql-explorer');
  await expect(graphqlExplorer2).toContainText('Characters who at any time bore a Ring of Power.');
  await page.click('text=QueryRingBearer >> button');

  // Send and assert GraphQL request
  await page.click('[data-testid="request-pane"] >> text=Send');
  const statusTag2 = page.locator('[data-testid="response-status-tag"]:visible');
  await expect(statusTag2).toContainText('200 OK');

  const responseBody2 = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });
  await expect(responseBody2).toContainText('"echoVars": null');
});

test('can render numeric environment', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  // Copy the collection with the graphql query to clipboard
  const text = await loadFixture('graphql.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  // Import from clipboard
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByLabel('Smoke GraphQL').click();

  // Open the graphql request
  await page.getByLabel('Request Collection').getByTestId('GraphQL request with number').press('Enter');
  await page.getByRole('tab', { name: 'Body' }).click();
  // Assert the schema is fetched after switching to GraphQL request
  await expect(page.getByText('Schema fetched just now')).toBeVisible();

  // Assert schema documentation stuff
  await page.getByRole('button', { name: 'schema' }).click();
  await page.getByRole('menuitem', { name: 'Show Documentation' }).click();
  await page.click('a:has-text("Query")');
  await page.locator('a:has-text("RingBearer")').click();
  const graphqlExplorer2 = page.locator('.graphql-explorer');
  await expect(graphqlExplorer2).toContainText('Characters who at any time bore a Ring of Power.');
  await page.click('text=QueryRingBearer >> button');

  // Send and assert GraphQL request
  await page.click('[data-testid="request-pane"] >> text=Send');
  const statusTag2 = page.locator('[data-testid="response-status-tag"]:visible');
  await expect(statusTag2).toContainText('200 OK');

  const responseBody2 = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });
  await expect(responseBody2).toContainText('"echoNum": 777');
});

test('can send GraphQL requests after editing and prettifying query', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  const text = await loadFixture('graphql.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByLabel('Smoke GraphQL').click();
  await page.getByLabel('Request Collection').getByTestId('GraphQL request').press('Enter');

  // Edit and prettify query
  await page.getByRole('tab', { name: 'Body' }).click();
  await page.locator('pre[role="presentation"]:has-text("bearer")').click();
  await page.locator('.app').press('Enter');
  await page.locator('text=Prettify GraphQL').click();
  await page.click('[data-testid="request-pane"] >> text=Send');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  await expect(statusTag).toContainText('200 OK');

  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });
  await expect(responseBody).toContainText('"bearer": "Gandalf"');
});
