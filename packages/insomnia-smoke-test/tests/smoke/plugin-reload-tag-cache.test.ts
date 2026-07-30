import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

const PLUGIN_NAME = 'insomnia-plugin-reload-probe';
const RESOLVED_VALUE = 'reload-probe-resolved';

// Same pattern used across the other plugin smoke tests (see sandbox-template-tags.test.ts /
// plugin-bridge.test.ts): write a plugin straight into the data-path plugins directory.
const writePlugin = (dataPath: string) => {
  const pluginDir = path.join(dataPath, 'plugins', PLUGIN_NAME);
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
          name: 'reloadprobe',
          displayName: 'Reload Probe',
          description: 'used to prove plugin reload reaches the render engine',
          args: [],
          run() {
            return '${RESOLVED_VALUE}';
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

test('Kong/insomnia#10295: reloading plugins picks up a plugin tag once a render has already run without it', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  await clearPluginToast(page);

  const fixture = await loadFixture('plugin-reload-cache-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  const responsePane = page.getByTestId('response-pane');
  const sendButton = page.getByTestId('request-pane').getByRole('button', { name: 'Send' });

  // Send a request whose only template tag is the built-in `{% uuid %}` (the custom plugin isn't
  // installed yet). This is the first render of the session, so it's what builds and caches the
  // persistent templating worker's Liquid engine, with no knowledge of the plugin.
  await insomnia.navigationSidebar.clickRequestOrFolder('Warmup');
  await sendButton.click();
  await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200');

  // Now the plugin appears on disk (mirrors: user fixes their environment, or a plugin gets added
  // mid-session).
  writePlugin(dataPath);

  // Reload plugins through the actual Settings > Plugins > Reload button.
  await insomnia.statusbar.openPreferences();
  await insomnia.preferencesPage.switchToPreferenceTab('Plugins');
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect.soft(page.getByTestId(PLUGIN_NAME)).toBeVisible();
  await insomnia.preferencesPage.closePreferences();

  // After reload: sending a request that uses the plugin's tag must resolve it and echo the
  // resolved header value back — proving reload actually reaches the persistent render worker's
  // cached engine, not just the plugin list shown in Settings.
  await insomnia.navigationSidebar.clickRequestOrFolder('Reload Probe');
  await expect
    .poll(
      async () => {
        await sendButton.click();
        return (await responsePane.textContent()) || '';
      },
      { timeout: 20_000 },
    )
    .toContain(RESOLVED_VALUE);
});
