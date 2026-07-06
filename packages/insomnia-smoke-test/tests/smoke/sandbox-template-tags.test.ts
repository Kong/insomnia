import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

const PLUGIN_NAME = 'insomnia-plugin-sandbox-probe';

// Write a probe plugin into the data-path plugins directory (same pattern as plugin-bridge.test.ts).
// - sandboxprobe: reports which execution path ran it (Node's `process` global exists in the legacy
//   main-process path but is absent inside QuickJS) and exercises an async host-bridge round-trip.
// - cryptoparity: a deterministic require('crypto') workload whose output must be byte-identical
//   between the legacy path and the sandbox path.
const installProbePlugin = (dataPath: string) => {
  const pluginDir = path.join(dataPath, 'plugins', PLUGIN_NAME);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    // The 'insomnia' key is required — the loader skips packages that lack it.
    JSON.stringify({ name: PLUGIN_NAME, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `
      module.exports.templateTags = [
        {
          name: 'sandboxprobe',
          displayName: 'Sandbox Probe',
          description: 'Reports whether it executed inside the QuickJS sandbox',
          args: [{ displayName: 'Label', type: 'string', defaultValue: 'hello' }],
          async run(context, label = 'hello') {
            const ranIn = typeof process === 'undefined' ? 'sandbox' : 'main-process';
            let arch = 'n/a';
            try {
              const hostOS = await context.util.nodeOS();
              arch = hostOS.arch;
            } catch (err) {
              arch = 'bridge-error:' + err.message;
            }
            return label + ' | ran in: ' + ranIn + ' | arch via bridge: ' + arch;
          },
        },
        {
          name: 'cryptoparity',
          displayName: 'Crypto Parity',
          description: 'Deterministic crypto workload for flag-on/off parity',
          args: [{ displayName: 'Input', type: 'string', defaultValue: 'insomnia-test' }],
          async run(context, input = 'insomnia-test') {
            return require('crypto').createHash('sha256').update(String(input)).digest('hex');
          },
        },
        {
          name: 'requireprobe',
          displayName: 'Require Probe',
          description: 'Requires the named module so tests can assert grant/deny behavior',
          args: [{ displayName: 'Module', type: 'string', defaultValue: 'path' }],
          async run(context, mod = 'path') {
            if (mod === 'path') {
              return require('path').join('a', 'b');
            }
            return typeof require(mod);
          },
        },
      ];
    `,
  );
};

test('Template tag sandbox: flag routes plugin tag execution into the QuickJS sandbox', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  installProbePlugin(dataPath);

  // The persistent "Plugin system updated" notification fires from a Root mount effect whenever
  // user plugins exist on disk, and its toast region intercepts pointer events over the page.
  // Seed its once-only guard so route remounts can't re-raise it, then clear any toast already
  // in flight before driving the UI.
  await page.getByLabel('Import').waitFor();
  await page.evaluate(() => localStorage.setItem('plugin-system-changes-toast-shown', 'true'));
  const dismissButtons = page.getByRole('button', { name: 'Dismiss' });
  await dismissButtons
    .first()
    .waitFor({ timeout: 3000 })
    .catch(() => {});
  while ((await dismissButtons.count()) > 0) {
    await dismissButtons.first().click();
  }

  // Import a collection whose request body contains the probe tags (the tags render as pills
  // lexically, so importing before the plugin is registered is fine).
  const fixture = await loadFixture('sandbox-probe-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  // Register the probe plugin through the bridge.
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  await insomnia.navigationSidebar.clickRequestOrFolder('Sandbox Probe');
  await page.getByText('Body', { exact: true }).click();

  // Open a tag pill in the body editor and assert its Live Preview output (auto-retries until the
  // render completes), then close the modal.
  const assertTagPreview = async (tagPrefix: string, expected: string) => {
    await page.locator(`[data-template^="${tagPrefix}"]`).click();
    const modal = page.getByRole('dialog');
    await expect.soft(modal.getByLabel('Live Preview')).toContainText(expected);
    await modal.getByRole('button', { name: 'Done' }).click();
  };

  const expectedHash = crypto.createHash('sha256').update('insomnia-test').digest('hex');

  // Flag off (default): tags run on the legacy main-process path.
  await assertTagPreview('{% sandboxprobe', 'e2e | ran in: main-process');
  await assertTagPreview('{% cryptoparity', expectedHash);

  // Toggle the sandbox on: Preferences → Scripting → "Run template tags in sandbox".
  await page.getByTestId('settings-button').click();
  await page.getByRole('tab', { name: 'Scripting' }).click();
  const sandboxToggle = page.getByTestId('toggle-template-tag-sandbox');
  await sandboxToggle.click();
  await expect.soft(sandboxToggle.getByRole('switch')).toBeChecked();
  await page.locator('.app').press('Escape');

  // Canary: the same tag now reports sandbox execution, and the async host bridge still round-trips.
  // Derive the expected arch from the Electron main process (where pluginToMainAPI runs) rather
  // than the Playwright runner, which can differ in cross-arch setups.
  const electronArch = await app.evaluate(() => process.arch);
  await assertTagPreview('{% sandboxprobe', `e2e | ran in: sandbox | arch via bridge: ${electronArch}`);

  // Parity: the sandboxed require('crypto') workload is byte-identical to the legacy render above.
  await assertTagPreview('{% cryptoparity', expectedHash);

  // Module gating (M1): the baseline grant resolves through the registry, while anything outside
  // it — npm packages and raw Node builtins alike — fails with the exact manifest denial message
  // that tells a plugin author what to declare.
  await assertTagPreview("{% requireprobe 'path'", 'a/b');
  await assertTagPreview("{% requireprobe 'left-pad'", "Module 'left-pad' not permitted by manifest");
  await assertTagPreview("{% requireprobe 'fs'", "Module 'fs' not permitted by manifest");
});
