import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('can make oauth2 requests', async ({ app, page }) => {
  const sendButton = page.locator('[data-testid="request-pane"] button:has-text("Send")');
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responseBody = page.locator('#json-response-viewer + div');

  const projectView = page.locator('#wrapper');

  const text = await loadFixture('oauth.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  // Test Folder Level Auth propagates to heirs

  // select the folder (collapses heirs
  await page.getByTestId('Folder Level Auth Code').click();

  await page.getByRole('tab', { name: 'Auth' }).click();
  await page.getByRole('button', { name: 'Clear' }).click();

  // expand the folder to see the heirs again
  await page.getByTestId('Folder Level Auth Code').click();
  await page.getByLabel('Request Collection').getByTestId('Request with Inherited Auth').press('Enter');
  await expect.soft(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/me');
  const [initialLoginPage] = await Promise.all([app.waitForEvent('window'), sendButton.click()]);
  await initialLoginPage.waitForLoadState();
  await initialLoginPage.waitForFunction("document.cookie !== ''");
  await initialLoginPage.locator('[name="login"]').fill('folder');
  await initialLoginPage.locator('[name="password"]').fill('folder');
  await initialLoginPage.locator('button:has-text("Sign-in")').click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"sub": "folder"');

  // go back to the folder's auth tab
  await page.getByTestId('Folder Level Auth Code').click();
  await page.getByRole('tab', { name: 'Auth' }).click();

  // clear the session (but keep the token!)
  await page.getByRole('button', { name: 'Clear OAuth 2 session', exact: true }).click();

  // reset ui state
  await page.getByTestId('Folder Level Auth Code').click();

  // No PKCE
  await projectView.getByLabel('Request Collection').getByTestId('No PKCE').press('Enter');
  await expect.soft(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/me');

  const [authorizationCodePage] = await Promise.all([app.waitForEvent('window'), sendButton.click()]);

  await authorizationCodePage.waitForLoadState();
  await authorizationCodePage.waitForFunction("document.cookie !== ''");
  await authorizationCodePage.locator('[name="login"]').fill('admin');
  await authorizationCodePage.locator('[name="password"]').fill('admin');
  await authorizationCodePage.locator('button:has-text("Sign-in")').click();

  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"sub": "admin"');

  // Navigate to the OAuth2 Tab and refresh the token from there
  await page.getByRole('tab', { name: 'Auth' }).click();
  await expect.soft(page.getByRole('button', { name: 'OAuth 2.0' })).toBeVisible();

  const tokenInput = page.locator('[for="Access-Token"] > input');
  const prevToken = await tokenInput.inputValue();
  await page.locator('button:has-text("Refresh Token")').click();
  await expect.soft(tokenInput).not.toHaveValue(prevToken);

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

  await expect.soft(tokenInput).not.toHaveValue('');

  // PKCE SHA256
  await page.getByLabel('Request Collection').getByTestId('PKCE SHA256').press('Enter');
  await expect.soft(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/me');
  await expect.soft(page.locator('#Grant-Type')).toHaveValue('authorization_code');
  await expect.soft(page.locator('#Code-Challenge-Method')).toHaveValue('S256');
  await sendButton.click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"sub": "admin"');

  // PKCE Plain
  await page.getByLabel('Request Collection').getByTestId('PKCE Plain').press('Enter');
  await expect.soft(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/me');
  await expect.soft(page.locator('#Grant-Type')).toHaveValue('authorization_code');
  await expect.soft(page.locator('#Code-Challenge-Method')).toHaveValue('plain');
  await sendButton.click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"sub": "admin"');

  // Inherited Auth from folder
  await page.getByLabel('Request Collection').getByTestId('Request with Inherited Auth').press('Enter');
  await expect.soft(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/me');
  await sendButton.click();
  await expect.soft(statusTag).toContainText('200 OK');
  // this is the original token from the first login
  await expect.soft(responseBody).toContainText('"sub": "folder"');

  // test to ensure that the token does not persist after clearing the folder's auth
  await page.getByTestId('Folder Level Auth Code').click();
  await page.getByRole('tab', { name: 'Auth' }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();

  // clear the session, too (so we can get a fresh one)
  await page.getByRole('button', { name: 'Clear OAuth 2 session', exact: true }).click();
  await page.getByTestId('Folder Level Auth Code').click(); // re-expand

  // try the request again, note that it attempts to re-authenticate
  // instead of re-using the original token (the real fix)
  await page.getByLabel('Request Collection').getByTestId('Request with Inherited Auth').press('Enter');
  await expect.soft(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/me');

  const [secondLoginPage] = await Promise.all([app.waitForEvent('window'), sendButton.click()]);
  await secondLoginPage.waitForLoadState();
  await secondLoginPage.waitForFunction("document.cookie !== ''");
  await secondLoginPage.locator('[name="login"]').fill('fresh');
  await secondLoginPage.locator('[name="password"]').fill('fresh');
  await secondLoginPage.locator('button:has-text("Sign-in")').click();

  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"sub": "fresh"');

  // Reset the OAuth 2 session from Preferences
  await page.getByTestId('settings-button').click();
  await page.locator('button:has-text("Clear OAuth 2 session")').click();
  await page.keyboard.press('Escape');

  // ID Token
  await page.getByLabel('Request Collection').getByTestId('ID Token').press('Enter');
  await expect.soft(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/id-token');
  await page.getByRole('tab', { name: 'Auth' }).click();
  await expect.soft(page.locator('#Grant-Type')).toHaveValue('implicit');

  const [implicitPage] = await Promise.all([app.waitForEvent('window'), sendButton.click()]);
  await implicitPage.waitForLoadState();
  await implicitPage.waitForFunction("document.cookie !== ''");
  await implicitPage.locator('[name="login"]').fill('admin');
  await implicitPage.locator('[name="password"]').fill('admin');
  await implicitPage.locator('button:has-text("Sign-in")').click();

  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"sub": "admin"');

  // ID and Access Token
  await page.getByLabel('Request Collection').getByTestId('ID and Access Token').press('Enter');
  await expect.soft(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/me');
  await expect.soft(page.locator('#Grant-Type')).toHaveValue('implicit');
  await sendButton.click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"sub": "admin"');

  // Reset the OAuth 2 session from Preferences
  await page.getByTestId('settings-button').click();
  await page.locator('button:has-text("Clear OAuth 2 session")').click();
  await page.keyboard.press('Escape');

  // Client Credentials
  await page.getByLabel('Request Collection').getByTestId('Client Credentials').press('Enter');
  await expect.soft(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/client-credential');
  await expect.soft(page.locator('#Grant-Type')).toHaveValue('client_credentials');
  await sendButton.click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"clientId": "client_credentials"');

  // Reset the OAuth 2 session from Preferences
  await page.getByTestId('settings-button').click();
  await page.locator('button:has-text("Clear OAuth 2 session")').click();
  await page.keyboard.press('Escape');

  // Resource Owner Password Credentials
  await page.getByLabel('Request Collection').getByTestId('Resource Owner Password Credentials').press('Enter');
  await expect.soft(page.locator('.app')).toContainText('http://127.0.0.1:4010/oidc/me');
  await expect.soft(page.locator('#Grant-Type')).toHaveValue('password');
  await sendButton.click();
  await expect.soft(statusTag).toContainText('200 OK');
  await expect.soft(responseBody).toContainText('"sub": "foo"');
});
