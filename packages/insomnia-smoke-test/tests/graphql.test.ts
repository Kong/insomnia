import { expect } from '@playwright/test';

import { loadFixture } from '../playwright/paths';
import { test } from '../playwright/test';

test('can send GraphQL requests', async ({ app, page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  await page.click('[data-testid="project"]');
  await page.click('text=Create');

  const text = await loadFixture('graphql.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.click('button:has-text("Clipboard")');
  await page.click('text=CollectionSmoke GraphQLjust now');
  await page.locator('button:has-text("POSTGQLGraphQL request")').click();
  await page.locator('[data-testid="request-pane"] button:has-text("schema")').click();
  await page.locator('button:has-text("Show Documentation")').click();
  await page.locator('a:has-text("Query")').click(),
  await page.locator('text=LordOfTheRings').nth(2).click(),
  await page.locator('text=This is a long paragraph that is a description for the enum value THETWOTOWERS').click();
  await page.locator('text=QueryLordOfTheRings >> button').click();
  await page.locator('[data-testid="request-pane"] >> text=Send').click();

  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  await expect(statusTag).toContainText('200 OK');
});
