import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// Folder names are entirely author-controlled — a plugin author picks their own install folder
// name — so prefixing the first plugin's folder to sort alphabetically before the second is not an
// artificial rig; it's the one thing a plugin author actually gets to choose here.
const FIRST_PLUGIN_NAME = 'insomnia-plugin-load-order-first';
const SECOND_PLUGIN_NAME = 'insomnia-plugin-load-order-second';

// Full host access ("elevated"): still runs in this same process, just with real Node access
// (`require('module')`) instead of the QuickJS sandbox. Its top-level code patches the module
// loader before returning any exports.
const installFirstPlugin = (dataPath: string) => {
  const dir = path.join(dataPath, 'plugins', '0-load-order-first');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: FIRST_PLUGIN_NAME, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  fs.writeFileSync(
    path.join(dir, 'index.js'),
    `
      (function () {
        var NodeModule = require('module');
        var ORIGINAL_REQUIRE = NodeModule.prototype.require;
        NodeModule.prototype.require = function (id) {
          if (id === 'quickjs-emscripten') {
            return {
              getQuickJS: function () {
                return Promise.reject(new Error('sandbox engine module substituted at plugin load time'));
              },
            };
          }
          return ORIGINAL_REQUIRE.apply(this, arguments);
        };
      })();
      module.exports = {};
    `,
  );
};

// Left in the default sandboxed mode (never elevated). Ships one template tag with a fixed return
// value, so any deviation from that value is unambiguous evidence something upstream went wrong.
const installSecondPlugin = (dataPath: string) => {
  const dir = path.join(dataPath, 'plugins', '1-load-order-second');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: SECOND_PLUGIN_NAME, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  fs.writeFileSync(
    path.join(dir, 'index.js'),
    `
      module.exports.templateTags = [{
        name: 'siblingtag',
        displayName: 'siblingtag',
        description: 'Fixed-value tag confirming the sandbox engine module reached this plugin unmodified',
        args: [],
        async run() {
          return 'sibling-tag-ok';
        },
      }];
    `,
  );
};

// Same pattern as sandbox-template-tags.test.ts's clearPluginToast: seed the once-only guard for the
// persistent "Plugin system updated" toast and dismiss any instance already in flight before driving
// the rest of the UI, since it can intercept pointer events over the page mid-render.
const clearPluginToast = async (page: Page) => {
  await page.getByLabel('Import').waitFor();
  await page.evaluate(() => localStorage.setItem('plugin-system-changes-toast-shown', 'true'));
  const dismissButtons = page.getByRole('button', { name: 'Dismiss' });
  await dismissButtons
    .first()
    .waitFor({ timeout: 3000 })
    .catch(() => {});
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && (await dismissButtons.count()) > 0) {
    // eslint-disable-next-line playwright/no-force-option -- necessary to avoid flakiness with re-rendering toast
    await dismissButtons
      .first()
      .click({ force: true, timeout: 500 })
      .catch(() => {});
  }
};

// Turns on the real "Sandbox all plugin code" toggle via Preferences -> Scripting — the flag that
// supersedes the older template-tag-only sandbox toggle.
const enablePluginSandbox = async (page: Page) => {
  await page.getByTestId('settings-button').click();
  const toggle = page.getByTestId('toggle-plugin-sandbox');
  await page.getByRole('tab', { name: 'Scripting' }).click();
  await toggle.getByRole('switch').waitFor();
  await toggle.click();
  await expect.soft(toggle.getByRole('switch')).toBeChecked();
  await page.locator('.app').press('Escape');
  await expect.soft(page.getByTestId('toggle-plugin-sandbox')).toBeHidden();
};

// Grants a plugin "Full host access" via the real Preferences -> Plugins checkbox and confirms the
// mode badge reflects it, then closes the modal. Toggling pluginConfig triggers its own plugin
// reload (the Plugins pane re-discovers on settings.pluginConfig change).
const setPluginElevated = async (page: Page, pluginName: string, expectedMode: string) => {
  await page.getByTestId('settings-button').click();
  await page.getByRole('tab', { name: 'Plugins' }).click();
  const elevatedToggle = page.getByTestId(`plugin-elevated-${pluginName}`);
  await elevatedToggle.waitFor();
  await elevatedToggle.click();
  await expect.soft(page.getByTestId(`plugin-mode-${pluginName}`)).toHaveText(expectedMode);
  await page.locator('.app').press('Escape');
  await expect.soft(elevatedToggle).toBeHidden();
};

test('a plugin loaded before a sandboxed sibling cannot substitute the sandbox engine module for it', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  installFirstPlugin(dataPath);
  installSecondPlugin(dataPath);
  await clearPluginToast(page);
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  // Grant the plugin whose folder sorts alphabetically first full host access, via the real
  // Preferences -> Plugins checkbox. The sandbox is still off at this point, so the mode badge
  // reads "In-process" (elevated and unsandboxed both run in-process while the sandbox is off) —
  // the underlying pluginConfig.elevated flag is set regardless, which is what matters for the
  // reload below.
  await setPluginElevated(page, FIRST_PLUGIN_NAME, 'In-process');

  // Turn on the sandbox for every other plugin. The second plugin is never elevated, so this is the
  // reload where it first goes through sandboxed discovery in this process — the same reload that
  // re-processes the first (already-elevated) plugin's folder.
  await enablePluginSandbox(page);

  // Confirm the mode badges now reflect the new state before proceeding — the first plugin is
  // genuinely running elevated (in-process) and the second is genuinely running sandboxed, which is
  // the precondition this scenario depends on.
  await page.getByTestId('settings-button').click();
  await page.getByRole('tab', { name: 'Plugins' }).click();
  await expect.soft(page.getByTestId(`plugin-mode-${FIRST_PLUGIN_NAME}`)).toHaveText('Elevated');
  await expect.soft(page.getByTestId(`plugin-mode-${SECOND_PLUGIN_NAME}`)).toHaveText('Sandboxed');
  await page.locator('.app').press('Escape');
  await expect.soft(page.getByTestId(`plugin-mode-${FIRST_PLUGIN_NAME}`)).toBeHidden();

  const fixture = await loadFixture('plugin-load-order-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await insomnia.navigationSidebar.clickRequestOrFolder('Load Order Probe');
  const responsePane = page.getByTestId('response-pane');

  // Poll the send so the just-toggled sandbox flag has had time to propagate to the main process
  // before this assertion runs.
  await expect
    .poll(
      async () => {
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
        return (await responsePane.textContent()) || '';
      },
      { timeout: 25_000 },
    )
    .toContain('sibling-tag-ok');
});
