import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// response.getBodyBuffer sits behind the models.read capability, which is granted to every template
// tag at baseline with no manifest declaration. This restricts it (via assertResponseBodyPathReadOwnership)
// to bodyPaths that belong to an already-persisted response.

const PLUGIN_NAME = 'insomnia-plugin-bodypath-read-scope';
const OUTSIDE_CONTENTS = 'sandbox-bodypath-read-scope-check-9f3c1a';

// Installs a template tag with no manifest permissions that reads a path via the baseline-granted
// context.util.models.response.getBodyBuffer bridge call.
const installReadPathPlugin = (dataPath: string) => {
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
          name: 'readpath',
          displayName: 'Read Path',
          description: 'Reads a path via response.getBodyBuffer with no declared permissions',
          args: [{ displayName: 'Path', type: 'string', defaultValue: '' }],
          async run(context, filePath) {
            var raw = await context.util.models.response.getBodyBuffer({ bodyPath: filePath });
            var bytes = (raw && raw.data) || [];
            var out = '';
            for (var i = 0; i < bytes.length; i++) { out += String.fromCharCode(bytes[i]); }
            return out;
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

// Enables the sandbox via the real Preferences → Scripting UI toggle, not a pre-set settings object.
const enableSandbox = async (page: Page) => {
  await page.getByTestId('settings-button').click();
  const sandboxToggle = page.getByTestId('toggle-plugin-sandbox');
  await page.getByRole('tab', { name: 'Scripting' }).click();
  await sandboxToggle.getByRole('switch').waitFor();
  await sandboxToggle.click();
  await expect.soft(sandboxToggle.getByRole('switch')).toBeChecked();
  await page.locator('.app').press('Escape');
  await expect.soft(page.getByTestId('toggle-plugin-sandbox')).toBeHidden();
};

test('response.getBodyBuffer restricts a zero-permission template tag to known response bodyPaths', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  // A file outside the Insomnia data directory, unrelated to any response.
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-outside-app-data-'));
  const outsidePath = path.join(outsideDir, 'file.txt');
  fs.writeFileSync(outsidePath, OUTSIDE_CONTENTS);

  try {
    installReadPathPlugin(dataPath);
    await clearPluginToast(page);

    const fixture = (await loadFixture('sandbox-probe-collection.yaml')).replace(
      /\{% sandboxprobe 'e2e' %\}[\s\S]*/,
      `{% readpath '${outsidePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' %}\n`,
    );
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

    await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

    await insomnia.navigationSidebar.clickRequestOrFolder('Sandbox Probe');
    await page.getByText('Body', { exact: true }).click();

    await enableSandbox(page);

    const readTagPreview = async (tagPrefix: string): Promise<string> => {
      await page.locator(`[data-template^="${tagPrefix}"]`).click();
      const modal = page.getByRole('dialog');
      const preview = modal.getByLabel('Live Preview');
      await expect.soft(preview).not.toHaveValue('rendering...');
      const value = (await preview.inputValue()).trim();
      await modal.getByRole('button', { name: 'Done' }).click();
      await expect.soft(modal).toBeHidden();
      return value;
    };

    // The just-toggled setting needs a moment to propagate to the main process before the tag runs
    // in the sandbox — poll until it does, then assert the read is refused.
    await expect.poll(() => readTagPreview('{% readpath'), { timeout: 20_000 }).toContain('does not belong to any known response');
  } finally {
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});
