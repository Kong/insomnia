import fs from 'node:fs';
import path from 'node:path';

import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

const PLUGIN_NAME = 'insomnia-plugin-bridge-test';
const ACTION_LABEL = 'Bridge Test Action';

test('Plugin bridge routes requestAction execution through hidden BrowserWindow', async ({ page, app, dataPath }) => {
  // Write a minimal plugin with a requestAction to the data-path plugins directory.
  const pluginDir = path.join(dataPath, 'plugins', PLUGIN_NAME);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    // The 'insomnia' key is required — the loader skips packages that lack it.
    JSON.stringify({ name: PLUGIN_NAME, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `module.exports.requestActions = [{ label: '${ACTION_LABEL}', action: async () => {} }];`,
  );

  // Import a collection so we have a request to target.
  const fixture = await loadFixture('simple.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  // Reload plugins through the bridge, awaiting completion.  This ensures the
  // hidden BrowserWindow has started and the test plugin is registered before we
  // check the UI.  page.evaluate awaits the returned Promise.
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  // Open the request actions dropdown for 'example http'.
  // onOpen calls window.main.plugins.getRequestActions() through the bridge.
  const requestRow = page.getByLabel('Request Collection').getByRole('row', { name: 'example http' });
  await requestRow.click();
  await requestRow.getByLabel('Request Actions').click();

  // The plugin action must appear in the dropdown, proving end-to-end bridge execution.
  await expect(page.getByRole('menuitemradio', { name: ACTION_LABEL })).toBeVisible();
});
