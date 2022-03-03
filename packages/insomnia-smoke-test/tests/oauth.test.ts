import { expect } from '@playwright/test';

import { loadFixture } from '../playwright/paths';
import { test } from '../playwright/test';

test('can make oauth2 requests', async ({ app, page }) => {
  test.slow();

  const sendButton = page.locator('[data-testid="request-pane"] button:has-text("Send")');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  await page.locator('[data-testid="project"]').click();
  await page.locator('text=Create').click();

  const text = await loadFixture('oauth.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.locator('button:has-text("Clipboard")').click();
  await page.locator('text=CollectionOauth Testingjust now').click();

  // Authorization code
  await page.locator('button:has-text("Authorization Code")').click();

  // No PKCE
  await page.locator('button:has-text("No PKCE")').click();

  // Wait for environment interpolation to be rendered
  await expect(page.locator('[data-testid="request-pane"]')).toContainText('_.oidc_base_path');

  const [authorizationCodePage] = await Promise.all([
    app.context().waitForEvent('page'),
    sendButton.click(),
  ]);

  await authorizationCodePage.waitForLoadState();
  await authorizationCodePage.locator('[name="login"]').fill('admin');
  await authorizationCodePage.locator('[name="password"]').fill('admin');
  await authorizationCodePage.locator('button:has-text("Sign-in")').click();
  await authorizationCodePage.locator('button:has-text("Continue")').click();

  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "admin"');

  // Navigate to the OAuth2 Tab and refresh the token from there
  await page.locator('li[role="tab"]:has-text("OAuth 2")').click();

  const tokenInput = page.locator('[for="Access-Token"] > input');
  const prevToken = await tokenInput.inputValue();
  await page.locator('button:has-text("Refresh Token")').click();
  await expect(tokenInput).not.toHaveValue(prevToken);

  // Clear the session and tokens and fetch a token manually
  await page.locator('text=Advanced Options').click();
  await page.locator('button:has-text("Clear OAuth 2 session")').click();
  await page.locator('button:text-is("Clear")').click();
  await page.locator('button:has-text("Click to confirm")').click();

  const [refreshPage] = await Promise.all([
    app.context().waitForEvent('page'),
    page.locator('button:has-text("Fetch Tokens")').click(),
  ]);

  await refreshPage.waitForLoadState();
  await refreshPage.locator('[name="login"]').fill('admin');
  await refreshPage.locator('[name="password"]').fill('admin');
  await refreshPage.locator('button:has-text("Sign-in")').click();
  await refreshPage.locator('text=Continue').click();

  await expect(tokenInput).not.toHaveValue('');

  // PKCE SHA256
  await page.locator('button:has-text("PKCE SHA256")').click();

  const [pkcePage] = await Promise.all([
    app.context().waitForEvent('page'),
    sendButton.click(),
  ]);
  await pkcePage.waitForLoadState();
  await pkcePage.locator('text=Continue').click();
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "admin"');

  // PKCE Plain
  await page.locator('button:has-text("PKCE Plain")').click();
  await sendButton.click();
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
    sendButton.click(),
  ]);
  await implicitPage.waitForLoadState();
  await implicitPage.locator('[name="login"]').fill('admin');
  await implicitPage.locator('[name="password"]').fill('admin');
  await implicitPage.locator('button:has-text("Sign-in")').click();
  await implicitPage.locator('text=Continue').click();

  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "admin"');

  // ID and Access Token
  await page.locator('button:has-text("ID and Access Token")').click();
  await sendButton.click();
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
  await sendButton.click();
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
  await sendButton.click();
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "foo"');
});
