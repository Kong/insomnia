import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

const PLUGIN_NAME = 'insomnia-plugin-sandbox-crypto-test';
// Fixed input so the expected digest is deterministic across runs.
const CRYPTO_INPUT = 'insomnia-sandbox-test';
const EXPECTED_DIGEST = crypto.createHash('sha256').update(CRYPTO_INPUT).digest('hex');

// A plugin template tag that:
//  - reports its execution context (`process` is absent inside the QuickJS sandbox, present in main)
//  - exercises the node:crypto shim via require('crypto') — the most common plugin dependency
const PLUGIN_INDEX = `
  module.exports.templateTags = [{
    name: 'sandboxcrypto',
    displayName: 'Sandbox Crypto Probe',
    description: 'Hashes a fixed string with node crypto and reports the execution context',
    args: [],
    run(context) {
      const crypto = require('crypto');
      const ranIn = typeof process === 'undefined' ? 'sandbox' : 'main-process';
      const digest = crypto.createHash('sha256').update('${CRYPTO_INPUT}').digest('hex');
      return ranIn + '|' + digest;
    },
  }];
`;

test('Plugin template tag runs in the QuickJS sandbox with a working node crypto shim', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  // Cold dev builds and the plugin reload can be slow; give the test extra headroom.
  test.slow();

  // Import a collection whose request body contains {% sandboxcrypto %} BEFORE writing the plugin,
  // so the plugin watcher's "Plugin system updated" toast can't intercept the import dialog clicks.
  const fixture = await loadFixture('sandbox-plugin-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  // Install the plugin into the data-path plugins directory (same approach as plugin-bridge.test.ts).
  // The 'insomnia' key is required — the loader skips packages that lack it.
  const pluginDir = path.join(dataPath, 'plugins', PLUGIN_NAME);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({ name: PLUGIN_NAME, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  fs.writeFileSync(path.join(pluginDir, 'index.js'), PLUGIN_INDEX);

  // Register the freshly-written plugin so its template tag resolves at render time.
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  // The plugin scan raises a transient toast that overlays the UI; wait for it to clear so it
  // doesn't intercept later clicks.
  const pluginToast = page.getByText('Plugin system updated');
  await pluginToast
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
    .catch(() => {});
  await pluginToast
    .first()
    .waitFor({ state: 'hidden', timeout: 15_000 })
    .catch(() => {});

  // Open the request and reveal the body editor so the template-tag widget renders.
  await insomnia.navigationSidebar.clickRequestOrFolder('Sandbox Crypto');
  await page.getByText('Body', { exact: true }).click();

  const tagWidget = page.locator('[data-template^="{% sandboxcrypto"]');

  const readPreview = async () => {
    await tagWidget.click();
    const modal = page.getByRole('dialog');
    const preview = modal.getByLabel('Live Preview');
    await expect.soft(preview).not.toHaveText('rendering...');
    return { modal, preview };
  };

  // Flag is off by default: the tag executes directly in the main process. The crypto digest is
  // already correct here because the legacy path has full Node access.
  {
    const { modal, preview } = await readPreview();
    await expect.soft(preview).toContainText(`main-process|${EXPECTED_DIGEST}`);
    await modal.getByRole('button', { name: 'Done' }).click();
  }

  // Toggle the template-tag sandbox on via Scripting settings.
  await page.getByTestId('settings-button').click();
  await page.getByRole('tab', { name: 'Scripting' }).click();
  await page.getByTestId('template-tag-sandbox-toggle').click();
  await page.locator('.app').press('Escape');

  // Flag is on: the tag now executes inside the QuickJS sandbox (no `process`), and the node crypto
  // shim must still produce the identical digest — proving crypto works end-to-end in the sandbox.
  {
    const { modal, preview } = await readPreview();
    await expect.soft(preview).toContainText(`sandbox|${EXPECTED_DIGEST}`);
    await modal.getByRole('button', { name: 'Done' }).click();
  }
});
