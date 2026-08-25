import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { test } from '../../playwright/test';

// A plugin whose require() throws (e.g. a declared dependency that was never installed) must show
// as a disabled row with a "Failed to load" marker instead of being dropped with no trace, while
// an unaffected sibling plugin keeps loading normally.

const WORKING_PLUGIN_NAME = 'insomnia-plugin-vanish-sibling-otp';
const BROKEN_PLUGIN_NAME = 'insomnia-plugin-vanish-sibling-ecobee';
const MISSING_MODULE = 'axios-never-actually-installed';
const WORKING_PLUGIN_DESCRIPTION = 'Generates one-time passcodes for the demo API';
const WORKING_PLUGIN_MODULES = ['crypto', 'uuid'];
const WORKING_PLUGIN_CAPABILITIES = ['network'];

// Declares a real insomnia.permissions manifest so Settings > Plugins' expandable details panel
// has something non-default to show.
const writeWorkingPlugin = (dataPath: string, name: string, tagName: string) => {
  const pluginDir = path.join(dataPath, 'plugins', name);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({
      name,
      version: '1.0.0',
      main: 'index.js',
      insomnia: {
        description: WORKING_PLUGIN_DESCRIPTION,
        permissions: { modules: WORKING_PLUGIN_MODULES, capabilities: WORKING_PLUGIN_CAPABILITIES },
      },
    }),
  );
  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `
      module.exports.templateTags = [
        {
          name: '${tagName}',
          displayName: '${tagName}',
          args: [],
          run() {
            return '${tagName}';
          },
        },
      ];
    `,
  );
};

// A plugin that requires an npm package which was never installed into its own node_modules.
const writeBrokenPluginWithMissingDependency = (dataPath: string, name: string) => {
  const pluginDir = path.join(dataPath, 'plugins', name);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({
      name,
      version: '1.1.0',
      main: 'index.js',
      insomnia: { name: 'ecobee auth0', description: 'Retrieves tokens needed to interact with an API' },
      dependencies: { [MISSING_MODULE]: '^1.0.0' },
    }),
  );
  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `
      require('${MISSING_MODULE}');
      module.exports.templateTags = [
        {
          name: 'vanishsiblingecobee',
          displayName: 'Vanish Sibling Ecobee',
          args: [],
          run() {
            return 'unreachable';
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

test('Kong/insomnia#10295: of two sibling plugins, the one requiring a never-installed dependency shows disabled with a load error, instead of vanishing, while the other loads fine', async ({
  page,
  insomnia,
  dataPath,
}) => {
  await clearPluginToast(page);
  writeWorkingPlugin(dataPath, WORKING_PLUGIN_NAME, 'vanishsiblingotp');
  writeBrokenPluginWithMissingDependency(dataPath, BROKEN_PLUGIN_NAME);

  await insomnia.statusbar.openPreferences();
  await insomnia.preferencesPage.switchToPreferenceTab('Plugins');
  await page.getByRole('button', { name: 'Reload', exact: true }).click();

  const workingRow = page.getByTestId(WORKING_PLUGIN_NAME);
  const workingRowToggle = page.getByTestId(`plugin-details-toggle-${WORKING_PLUGIN_NAME}`);
  const workingRowDetail = page.getByTestId(`plugin-details-${WORKING_PLUGIN_NAME}`);
  const brokenRow = page.getByTestId(BROKEN_PLUGIN_NAME);
  const brokenRowToggle = page.getByTestId(`plugin-details-toggle-${BROKEN_PLUGIN_NAME}`);
  const brokenRowDetail = page.getByTestId(`plugin-details-${BROKEN_PLUGIN_NAME}`);

  await expect.soft(workingRow).toBeVisible({ timeout: 10_000 });
  await expect.soft(brokenRow).toBeVisible({ timeout: 10_000 });

  // The working sibling declares a real permissions manifest — expanding its details should show
  // the full effective grant (baseline ∪ declared), not just the declared extras.
  await workingRowToggle.click();
  await expect.soft(workingRowDetail).toBeVisible();
  await expect.soft(workingRowDetail).toContainText(WORKING_PLUGIN_DESCRIPTION);
  for (const module of WORKING_PLUGIN_MODULES) {
    await expect.soft(workingRowDetail).toContainText(module);
  }
  for (const capability of WORKING_PLUGIN_CAPABILITIES) {
    await expect.soft(workingRowDetail).toContainText(capability);
  }
  await workingRowToggle.click();
  await expect.soft(workingRowDetail).toBeHidden();
  await expect.soft(brokenRow).toContainText('Failed to load plugin');
  // A load-error row has no checkbox at all.
  await expect.soft(brokenRow.getByRole('checkbox')).toHaveCount(0);

  // The detail panel is collapsed until the row is clicked, and expands inline (pushing later
  // rows down) — clicking anywhere on the row toggles it, not just a dedicated icon.
  await expect.soft(brokenRowDetail).toBeHidden();
  await brokenRowToggle.click();
  await expect.soft(brokenRowDetail).toBeVisible();
  await expect.soft(brokenRowDetail).toContainText(MISSING_MODULE);
  await brokenRowToggle.click();
  await expect.soft(brokenRowDetail).toBeHidden();

  // Reload repeatedly — deterministic, so this never changes.
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await workingRow.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await workingRow.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

  const workingStillVisible = await workingRow.count().then(c => c > 0);
  const brokenStillVisibleAndDisabled = await brokenRow.count().then(c => c > 0);
  expect.soft(workingStillVisible, 'the unaffected sibling should keep working across Reloads').toBe(true);
  expect.soft(brokenStillVisibleAndDisabled, 'the broken plugin should keep showing (disabled) across Reloads, not flicker in and out').toBe(true);

  await page.getByRole('button', { name: 'New Plugin' }).click();
  const nameWithoutPrefix = BROKEN_PLUGIN_NAME.replace(/^insomnia-plugin-/, '');
  await page.getByTestId('plugin-name-input').fill(nameWithoutPrefix);
  await page.getByTestId('generate-plugin-button').click();

  const nameError = page.getByTestId('plugin-name-error');
  await expect.soft(nameError).toHaveText(/already exists/i, { timeout: 5000 });
});
