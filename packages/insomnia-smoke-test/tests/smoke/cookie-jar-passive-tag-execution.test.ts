import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

const PLUGIN_NAME = 'insomnia-plugin-cookie-passive-render-probe';

// A single template tag whose only job is to report where it executed — the same
// INSOMNIA_TEMPLATE_SANDBOX canary used throughout this suite (defined only inside the QuickJS
// sandbox), so a caller can tell the sandbox genuinely ran this rather than the legacy in-process path.
const installProbePlugin = (dataPath: string) => {
  const pluginDir = path.join(dataPath, 'plugins', PLUGIN_NAME);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({ name: PLUGIN_NAME, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `
      module.exports.templateTags = [{
        name: 'cookieprobe',
        displayName: 'Cookie Probe',
        description: 'Reports whether it executed, and where',
        args: [],
        async run() {
          var ranIn = typeof INSOMNIA_TEMPLATE_SANDBOX !== 'undefined' ? 'sandbox' : 'main-process';
          return 'cookie-probe-ran-in-' + ranIn;
        },
      }];
    `,
  );
};

// Same pattern as sandbox-template-tags.test.ts's clearPluginToast.
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

// Turns on the real "Sandbox all plugin code" toggle via Preferences -> Scripting, the same helper
// shape used by plugin-load-order-sandbox-engine-integrity.test.ts.
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

test('a plugin tag stored in a cookie value is shown literally, not executed, merely by opening Manage Cookies', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  installProbePlugin(dataPath);
  await clearPluginToast(page);

  const fixture = await loadFixture('simple.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  // Enabling the sandbox here — before the tag is ever rendered — is what makes this test's
  // outcome meaningful: if the rendered cookie output below reports `sandbox`, the tag genuinely
  // executed through the real QuickJS sandbox, not the pre-T1 legacy in-process fallback.
  await enablePluginSandbox(page);

  // Author a cookie whose value is a plugin tag call, entirely through the real Cookies UI — no
  // Set-Cookie response, no Send. Mirrors the raw-cookie-string editing flow already exercised by
  // cookie-editor-interactions.test.ts.
  await page.getByRole('button', { name: 'Cookies' }).click();
  await page.getByLabel('Cookies Modal').getByRole('button', { name: 'Add Cookie' }).click();
  await page.getByTestId('cookie-test-iteration-0').getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('tab', { name: 'Raw' }).click();
  await page
    .locator('text=Raw Cookie String >> input[type="text"]')
    .fill('probe={% cookieprobe %}; Domain=localhost; Path=/');
  await page.locator('text=Done').nth(1).click();

  // Never clicked Send, never opened a tag's Live Preview pill (the explicit, per-tag opt-in the
  // request-body editor requires — see sandbox-template-tags.test.ts's assertTagPreview). The
  // cookie list shows every cookie's value literally, so the tag call should appear as unexecuted
  // text in the still-open Cookies modal, never as the tag's rendered output.
  const cookieRow = page.getByTestId('cookie-test-iteration-0');
  await expect.poll(async () => await cookieRow.textContent(), { timeout: 20_000 }).toContain('{% cookieprobe %}');
  await expect.soft(cookieRow).not.toContainText('cookie-probe-ran-in-sandbox');
  await expect.soft(cookieRow).not.toContainText('cookie-probe-ran-in-main-process');
});
