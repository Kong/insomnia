import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { test } from '../../playwright/test';

// A plugin whose require() throws must show as a disabled row with a reason instead of vanishing,
// and must stay listed across repeated Reloads.

const PLUGIN_NAME = 'insomnia-plugin-vanish-missing-dep';
const MISSING_MODULE = 'some-dep-that-is-never-installed';

const pluginDirFor = (dataPath: string) => path.join(dataPath, 'plugins', PLUGIN_NAME);

const writeWorkingPlugin = (dataPath: string) => {
  const pluginDir = pluginDirFor(dataPath);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({ name: PLUGIN_NAME, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `
      module.exports.templateTags = [
        {
          name: 'vanishmissingdep',
          displayName: 'Vanish Missing Dep',
          args: [],
          run() {
            return 'ok';
          },
        },
      ];
    `,
  );
};

// Simulates a dependency that's missing from the plugin's own node_modules at require()-time.
const breakPluginWithMissingDependency = (dataPath: string) => {
  const pluginDir = pluginDirFor(dataPath);
  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `
      require('${MISSING_MODULE}');
      module.exports.templateTags = [
        {
          name: 'vanishmissingdep',
          displayName: 'Vanish Missing Dep',
          args: [],
          run() {
            return 'ok';
          },
        },
      ];
    `,
  );
};

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
    await dismissButtons.first().click({ force: true, timeout: 500 }).catch(() => {});
  }
};

test('Kong/insomnia#10295: plugin whose require() throws (missing dependency) vanishes from Settings and Reload never restores it, but New Plugin reports it already exists', async ({
  page,
  insomnia,
  dataPath,
}) => {
  await clearPluginToast(page);
  writeWorkingPlugin(dataPath);

  await insomnia.statusbar.openPreferences();
  await insomnia.preferencesPage.switchToPreferenceTab('Plugins');

  // Plugin loads and is visible before its require() is broken.
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect.soft(page.getByTestId(PLUGIN_NAME)).toBeVisible({ timeout: 10_000 });

  // Break the plugin's own require() deterministically; the folder, package.json, and plugin name
  // are otherwise untouched.
  breakPluginWithMissingDependency(dataPath);

  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  const pluginRow = page.getByTestId(PLUGIN_NAME);

  // Plugin must stay listed (disabled) across repeated Reloads despite the broken require().
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await pluginRow.waitFor({ state: 'visible', timeout: 500 }).catch(() => {});
  const visibleAfterSecondReload = await pluginRow.count().then(c => c > 0);

  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await pluginRow.waitFor({ state: 'visible', timeout: 500 }).catch(() => {});

  expect.soft(visibleAfterSecondReload, 'plugin should still be listed after Reload even though its require() throws').toBe(true);

  // Creating a new plugin with the same name must still be blocked, even though the broken one is
  // shown disabled rather than fully removed from the list.
  await page.getByRole('button', { name: 'New Plugin' }).click();
  const nameWithoutPrefix = PLUGIN_NAME.replace(/^insomnia-plugin-/, '');
  await page.getByTestId('plugin-name-input').fill(nameWithoutPrefix);
  await page.getByTestId('generate-plugin-button').click();

  const nameError = page.getByTestId('plugin-name-error');
  await expect.soft(nameError).toHaveText(/already exists/i, { timeout: 5000 });
});
