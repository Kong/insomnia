import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can render schema and send GraphQL requests', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  // Create a new the project
  await page.click('[data-testid="project"]');
  await page.click('text=Create');

  // Copy the collection with the graphql query to clipboard
  const text = await loadFixture('graphql.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  // Import from clipboard
  await page.click('button:has-text("Clipboard")');
  // Open the new collection workspace
  await page.click('text=CollectionSmoke GraphQLjust now');
  // Open the graphql request
  await page.click('button:has-text("POSTGQLGraphQL request")');

  // Assert schema documentation stuff
  await page.click('[data-testid="request-pane"] button:has-text("schema")');
  await page.click('button:has-text("Show Documentation")');
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
