import { expect } from '@playwright/test';

import { loadFixture } from '../playwright/paths';
import { test } from '../playwright/test';

test('can make oauth2 requests', async ({ app, page }) => {
  await page.click('[data-testid="project"]');
  await page.click('text=Create');

  const text = await loadFixture('oauth.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.click('button:has-text("Clipboard")');
  await page.click('text=CollectionOauth Testingjust now');

  await page.click('button:has-text("Authorization Code")');
  await page.click('button:has-text("GETNo PKCE")');

  const [signinPage] = await Promise.all([
    app.context().waitForEvent('page'),
    page.click('text=Send'),
  ]);

  await signinPage.type('[name="login"]', 'admin');
  await signinPage.type('[name="password"]', 'admin');
  await signinPage.click('button:has-text("Sign-in")');
  await signinPage.click('text=Continue');

  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "admin"');
});
