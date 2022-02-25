import { expect } from '@playwright/test';

import { loadFixture } from '../playwright/paths';
import { test } from '../playwright/test';

test('can make oauth2 requests', async ({ app, page }) => {
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  await page.click('[data-testid="project"]');
  await page.click('text=Create');

  const text = await loadFixture('oauth.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.click('button:has-text("Clipboard")');
  await page.click('text=CollectionOauth Testingjust now');

  // Authorization code
  await page.click('button:has-text("Authorization Code")');

  // No PKCE
  await page.click('button:has-text("No PKCE")');

  const [authorizationCodePage] = await Promise.all([
    app.context().waitForEvent('page'),
    page.click('[data-testid="request-pane"] button:has-text("Send")'),
  ]);

  await authorizationCodePage.type('[name="login"]', 'admin');
  await authorizationCodePage.type('[name="password"]', 'admin');
  await authorizationCodePage.click('button:has-text("Sign-in")');
  await authorizationCodePage.click('text=Continue');

  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "admin"');

  // Navigate to the OAuth2 Tab and refresh the token from there
  await page.locator('li[role="tab"]:has-text("OAuth 2")').click();

  const token = page.locator('[placeholder="n\\/a"] >> nth=2');
  const oldToken = await token.inputValue();
  await page.locator('button:has-text("Refresh Token")').click();
  await expect(token).not.toHaveValue(oldToken);

  // Clear the session and tokens and fetch a token manually
  await page.locator('text=Advanced Options').click();
  await page.locator('button:has-text("Clear OAuth 2 session")').click();
  await page.locator('button:text-is("Clear")').click();
  await page.locator('button:has-text("Click to confirm")').click();

  const [refreshPage] = await Promise.all([
    app.context().waitForEvent('page'),
    page.locator('button:has-text("Fetch Tokens")').click(),
  ]);

  await refreshPage.type('[name="login"]', 'admin');
  await refreshPage.type('[name="password"]', 'admin');
  await refreshPage.click('button:has-text("Sign-in")');
  await refreshPage.click('text=Continue');

  await expect(token).not.toHaveValue('');

  // PKCE SHA256
  await page.click('button:has-text("GETPKCE SHA256")');

  const [pkcePage] = await Promise.all([
    app.context().waitForEvent('page'),
    page.click('[data-testid="request-pane"] button:has-text("Send")'),
  ]);
  await pkcePage.click('text=Continue');
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "admin"');

  // PKCE Plain
  await page.click('button:has-text("GETPKCE Plain")');
  await page.click('[data-testid="request-pane"] button:has-text("Send")');
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "admin"');

  // Reset the OAuth 2 session from Preferences
  if (process.platform === 'darwin') {
    await page.keyboard.press('Meta+,');
  } else {
    await page.keyboard.press('Control+,');
  }
  await page.locator('button:has-text("Clear OAuth 2 session")').click();
  await page.keyboard.press('Escape');

  // Implicit
  await page.locator('button:has-text("Implicit")').click();

  // ID Token
  await page.locator('button:has-text("ID Token")').click();

  const [implicitPage] = await Promise.all([
    app.context().waitForEvent('page'),
    page.click('[data-testid="request-pane"] button:has-text("Send")'),
  ]);

  await implicitPage.type('[name="login"]', 'admin');
  await implicitPage.type('[name="password"]', 'admin');
  await implicitPage.click('button:has-text("Sign-in")');
  await implicitPage.click('text=Continue');

  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "admin"');

  // ID and Access Token
  await page.locator('button:has-text("ID and Access Token")').click();
  await page.click('[data-testid="request-pane"] button:has-text("Send")');
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "admin"');

  // Reset the OAuth 2 session from Preferences
  if (process.platform === 'darwin') {
    await page.keyboard.press('Meta+,');
  } else {
    await page.keyboard.press('Control+,');
  }
  await page.locator('button:has-text("Clear OAuth 2 session")').click();
  await page.keyboard.press('Escape');

  // Client Credentials
  await page.locator('button:has-text("Client Credentials")').click();
  await page.click('[data-testid="request-pane"] button:has-text("Send")'),
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"clientId": "client_credentials"');

  // Reset the OAuth 2 session from Preferences
  if (process.platform === 'darwin') {
    await page.keyboard.press('Meta+,');
  } else {
    await page.keyboard.press('Control+,');
  }
  await page.locator('button:has-text("Clear OAuth 2 session")').click();
  await page.keyboard.press('Escape');

  // Resource Owner Password Credentials
  await page.locator('button:has-text("Resource Owner Password Credentials")').click();
  await page.click('[data-testid="request-pane"] button:has-text("Send")'),
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "foo"');
});
