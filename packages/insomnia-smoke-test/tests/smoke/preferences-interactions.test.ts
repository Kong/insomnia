import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test('Preferences through click', async ({ page }) => {
  await page.getByTestId('settings-button').click();
  await page.locator('text=Insomnia Preferences').first().click();
});

test('Preferences through keyboard shortcut', async ({ page }) => {
  await page.locator('.app').press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');
  await page.locator('text=Insomnia Preferences').first().click();
});

test('AI URL settings persist advanced options', async ({ page }) => {
  await page.evaluate(async () => {
    await window.main.llm.updateBackendConfig('url', {
      url: 'https://llm.local/v1',
      model: 'gpt-4o-mini',
      apiKey: 'persisted-token',
      temperature: 0.7,
      topP: 0.95,
      maxTokens: 4096,
    });
    await window.main.llm.setActiveBackend('url');
  });

  await page.getByTestId('settings-button').click();
  await page.locator('text=Insomnia Preferences').first().click();
  await page.getByRole('tab', { name: 'AI Settings' }).click();
  await page.getByRole('button', { name: 'LLM URL Active' }).click();

  await expect.soft(page.getByLabel('LLM URL')).toHaveValue('https://llm.local/v1');
  await expect.soft(page.getByLabel('API Token')).toHaveValue('persisted-token');

  await page.getByRole('button', { name: 'Advanced Options' }).click();
  await expect.soft(page.getByLabel('Temperature (0-2):')).toHaveValue('0.7');
  await expect.soft(page.getByLabel('Top P (0-1):')).toHaveValue('0.95');
  await expect.soft(page.getByLabel('Max Tokens (1-128000):')).toHaveValue('4096');
});

test('AI URL settings can deactivate active backend', async ({ page }) => {
  await page.evaluate(async () => {
    await window.main.llm.updateBackendConfig('url', {
      url: 'https://llm-deactivate.local/v1',
      model: 'gpt-4o-mini',
      apiKey: 'activation-token',
      temperature: 0.6,
      topP: 0.9,
      maxTokens: 8192,
    });
    await window.main.llm.setActiveBackend('url');
  });

  await page.getByTestId('settings-button').click();
  await page.locator('text=Insomnia Preferences').first().click();
  await page.getByRole('tab', { name: 'AI Settings' }).click();
  await page.getByRole('button', { name: 'LLM URL Active' }).click();

  await expect.soft(page.getByText('Active model:')).toBeVisible();
  await expect.soft(page.getByText('gpt-4o-mini')).toBeVisible();
  await expect.soft(page.getByRole('button', { name: 'Deactivate' })).toBeVisible();

  await page.getByRole('button', { name: 'Deactivate' }).click();

  await expect.soft(page.getByRole('button', { name: 'LLM URL' })).toBeVisible();
  await expect.soft(page.getByRole('button', { name: 'LLM URL Active' })).toHaveCount(0);

  const [activeBackend, backendConfig] = await page.evaluate(async () => {
    const active = await window.main.llm.getActiveBackend();
    const config = await window.main.llm.getBackendConfig('url');
    return [active, config] as const;
  });

  expect.soft(activeBackend).toBeNull();
  expect.soft(backendConfig).toMatchObject({
    backend: 'url',
    url: 'https://llm-deactivate.local/v1',
    model: 'gpt-4o-mini',
    apiKey: 'activation-token',
    temperature: 0.6,
    topP: 0.9,
    maxTokens: 8192,
  });
});

// Quick reproduction for Kong/insomnia#5664 and INS-2267
test('Check filter responses by environment preference', async ({ app, page, insomnia }) => {
  const text = await loadFixture('simple.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  // Send a request
  await insomnia.navigationSidebar.clickRequestOrFolder('example http');
  await page.click('[data-testid="request-pane"] button:has-text("Send")');
  await page.click('text=Console');
  await page.locator('text=HTTP/1.1 200 OK').click();

  // Set filter responses by environment
  await page.getByTestId('settings-button').click();
  await page.locator('text=Insomnia Preferences').first().click();
  await page.locator('text=Filter responses by environment').click();
  await page.locator('.app').press('Escape');

  // Re-send the request and check timeline
  await page.locator('[data-testid="request-pane"] button:has-text("Send")').click();
  await page.click('text=Console');
  await page.locator('text=HTTP/1.1 200 OK').click();
});

test('Enable http and https proxies', async ({ app, page, insomnia }) => {
  const responsePane = page.getByTestId('response-pane');

  await page.getByTestId('settings-button').click();
  await page.locator('text=Insomnia Preferences').first().click();
  await page.locator('[name="timeout"]').fill('1000');

  await page.getByRole('tab', { name: 'Proxy' }).click();
  await page.locator('text=Enable proxy').click();
  await page.locator('[name="httpProxy"]').fill('127.0.0.1:1111');
  await page.locator('[name="httpsProxy"]').fill('127.0.0.1:2222');
  await page.locator('[name="noProxy"]').fill('');
  await page.locator('.app').press('Escape');

  const text = await loadFixture('simple.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  // send the request and check timeline
  await insomnia.navigationSidebar.clickRequestOrFolder('proxyEnabled');
  await page.locator('[data-testid="request-pane"] button:has-text("Send")').click();
  await page.click('text=Console');
  await expect.soft(responsePane).toContainText('Trying 127.0.0.1:1111'); // updated proxy
});
