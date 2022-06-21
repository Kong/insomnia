import { expect } from '@playwright/test';

import { loadFixture } from '../playwright/paths';
import { test } from '../playwright/test';

test('can render schema and send GraphQL requests', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  await page.click('[data-testid="project"]');
  await page.click('text=Create');

  const text = await loadFixture('graphql.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.click('button:has-text("Clipboard")');
  await page.click('text=CollectionSmoke GraphQLjust now');
  await page.click('button:has-text("POSTGQLGraphQL request")');

  await page.click('[data-testid="request-pane"] button:has-text("schema")');
  await page.click('button:has-text("Show Documentation")');
  await page.click('a:has-text("Query")');
  await page.locator('a:has-text("LordOfTheRings")').click();
  const graphqlDoc = page.locator('.graphql-explorer');
  await expect(graphqlDoc).toContainText('This is a long paragraph that is a description for the enum value THETWOTOWERS');
  await page.click('text=QueryLordOfTheRings >> button');

  await page.click('[data-testid="request-pane"] >> text=Send');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  await expect(statusTag).toContainText('200 OK');

  const responseBody = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });
  await expect(responseBody).toContainText('"exampleEnum": "FELLOWSHIPOFTHERING"');
});
