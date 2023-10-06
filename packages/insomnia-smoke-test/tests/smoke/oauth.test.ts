import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can make oauth2 requests', async ({ app, page }) => {
  if (process.platform === 'darwin') {
    test.setTimeout(6 * 60 * 1000);
  } else {
    test.slow();
  }

  const sendButton = page.locator('[data-testid="request-pane"] button:has-text("Send")');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('[data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });

  const projectView = page.locator('#wrapper');
  await projectView.getByRole('button', { name: 'Create in project' }).click();

  const text = await loadFixture('oauth.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByRole('menuitemradio', { name: 'Import' }).click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByText('CollectionOAuth Testingjust now').click();

  // No PKCE
  await projectView.getByLabel('Request Collection').getByRole('row', { name: 'No PKCE' }).click();
  await expect(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/me');

  const [authorizationCodePage] = await Promise.all([
    app.waitForEvent('window'),
    sendButton.click(),
  ]);

  await authorizationCodePage.waitForLoadState();
  await authorizationCodePage.waitForFunction("document.cookie !== ''");
  await authorizationCodePage.locator('[name="login"]').fill('admin');
  await authorizationCodePage.locator('[name="password"]').fill('admin');
  await authorizationCodePage.locator('button:has-text("Sign-in")').click();

  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "admin"');

  // Navigate to the OAuth2 Tab and refresh the token from there
  await page.getByRole('tab', { name: 'OAuth 2' }).click();

  const tokenInput = page.locator('[for="Access-Token"] > input');
  const prevToken = await tokenInput.inputValue();
  await page.locator('button:has-text("Refresh Token")').click();
  await expect(tokenInput).not.toHaveValue(prevToken);

  // Clear the session and tokens and fetch a token manually
  await page.locator('text=Advanced Options').click();
  await page.locator('button:has-text("Clear OAuth 2 session")').click();
  await page.locator('button:text-is("Clear")').click();

  const [refreshPage] = await Promise.all([
    app.waitForEvent('window'),
    page.locator('button:has-text("Fetch Tokens")').click(),
  ]);

  await refreshPage.waitForLoadState();
  // expect an _interaction cookie to be set with the sign in form
  await refreshPage.waitForFunction("document.cookie !== ''");
  await refreshPage.locator('[name="login"]').fill('admin');
  await refreshPage.locator('[name="password"]').fill('admin');
  await refreshPage.locator('button:has-text("Sign-in")').click();

  await expect(tokenInput).not.toHaveValue('');

  // PKCE SHA256
  await page.getByLabel('Request Collection').getByRole('row', { name: 'PKCE SHA256' }).click();
  await expect(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/me');
  await expect(page.locator('#Grant-Type')).toHaveValue('authorization_code');
  await expect(page.locator('#Code-Challenge-Method')).toHaveValue('S256');
  await sendButton.click();
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "admin"');

  // PKCE Plain
  await page.getByLabel('Request Collection').getByRole('row', { name: 'PKCE Plain' }).click();
  await expect(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/me');
  await expect(page.locator('#Grant-Type')).toHaveValue('authorization_code');
  await expect(page.locator('#Code-Challenge-Method')).toHaveValue('plain');
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

  // ID Token
  await page.getByLabel('Request Collection').getByRole('row', { name: 'ID Token' }).click();
  await expect(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/id-token');
  await expect(page.locator('#Grant-Type')).toHaveValue('implicit');

  const [implicitPage] = await Promise.all([
    app.waitForEvent('window'),
    sendButton.click(),
  ]);
  await implicitPage.waitForLoadState();
  await implicitPage.waitForFunction("document.cookie !== ''");
  await implicitPage.locator('[name="login"]').fill('admin');
  await implicitPage.locator('[name="password"]').fill('admin');
  await implicitPage.locator('button:has-text("Sign-in")').click();

  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "admin"');

  // ID and Access Token
  await page.getByLabel('Request Collection').getByRole('row', { name: 'ID and Access Token' }).click();
  await expect(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/me');
  await expect(page.locator('#Grant-Type')).toHaveValue('implicit');
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
  await page.getByLabel('Request Collection').getByRole('row', { name: 'Client Credentials' }).click();
  await expect(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/client-credential');
  await expect(page.locator('#Grant-Type')).toHaveValue('client_credentials');
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
  await page.getByLabel('Request Collection').getByRole('row', { name: 'Resource Owner Password Credentials' }).click();
  await expect(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/me');
  await expect(page.locator('#Grant-Type')).toHaveValue('password');
  await sendButton.click();
  await expect(statusTag).toContainText('200 OK');
  await expect(responseBody).toContainText('"sub": "foo"');
});
