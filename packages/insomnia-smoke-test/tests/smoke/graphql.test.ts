import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can render schema and send GraphQL requests', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  // Create a new the project
  await page.getByTestId('project').click();
  await page.getByRole('button', { name: 'Create' }).click();

  // Copy the collection with the graphql query to clipboard
  const text = await loadFixture('graphql.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  // Import from clipboard
  await page.getByRole('menuitem', { name: 'Clipboard' }).click();
  // Open the new collection workspace
  await page.click('text=CollectionSmoke GraphQLjust now');
  // Open the graphql request
  await page.getByRole('button', { name: 'GraphQL request' }).click();
  // Assert the schema is fetched after switching to GraphQL request
  await expect(page.locator('.app')).toContainText('schema fetched just now');

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

  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });
  await expect(responseBody).toContainText('"bearer": "Gandalf"');
});

test('can send GraphQL requests after editing and prettifying query', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  // Create a new the project
  await page.getByTestId('project').click();
  await page.getByRole('button', { name: 'Create' }).click();

  const text = await loadFixture('graphql.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByRole('menuitem', { name: 'Clipboard' }).click();
  await page.click('text=CollectionSmoke GraphQLjust now');
  await page.getByRole('button', { name: 'GraphQL request' }).click();

  // Edit and prettify query
  await page.locator('pre[role="presentation"]:has-text("hello,")').click();
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
