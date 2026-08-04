import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// response.getBodyBuffer sits behind the models.read capability, which is granted to every template
// tag at baseline with no manifest declaration. When a caller supplies response._id, the handler
// re-loads that response server-side and reads only its own bodyPath — ignoring whatever bodyPath the
// caller supplied alongside it. This closes a residual gap: pairing a real id (satisfying the
// pre-fix, bodyPath-only ownership check, which merely asks "does this bodyPath belong to *some*
// response") with a *different*, real response's bodyPath used to still read that other response's
// content (CROSS-TENANT-DB-ACCESS-FINDINGS.md Finding 5's write-up, closed by SEC-SERVICES-FIXES-AUDIT-PLAN.md
// Item 1).

const PLUGIN_NAME = 'insomnia-plugin-getbodybuffer-id-scope';
const SELF_MARKER = 'SELF-CONTENT-MARKER-7f3a9c';
const VICTIM_MARKER = 'VICTIM-CONTENT-MARKER-9c1e4b';

// Installs a template tag with no manifest permissions that looks up its own response by id (via the
// baseline-granted response.getLatestForRequestId) and its "victim" response by id, then calls
// response.getBodyBuffer with its own real id paired with the victim's real bodyPath.
const installIdScopeProbePlugin = (dataPath: string) => {
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
          name: 'getbodybufferidprobe',
          displayName: 'GetBodyBuffer Id Probe',
          description: 'Reads its own response by id while pairing it with a different, real response bodyPath',
          args: [
            { displayName: 'Self Request Id', type: 'string', defaultValue: '' },
            { displayName: 'Victim Request Id', type: 'string', defaultValue: '' },
          ],
          async run(context, selfRequestId, victimRequestId) {
            var selfResp = await context.util.models.response.getLatestForRequestId(selfRequestId, null);
            var victimResp = await context.util.models.response.getLatestForRequestId(victimRequestId, null);
            if (!selfResp || !victimResp) { return 'MISSING_RESPONSE'; }
            var raw = await context.util.models.response.getBodyBuffer({ _id: selfResp._id, bodyPath: victimResp.bodyPath });
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
  const sandboxToggle = page.getByTestId('toggle-template-tag-sandbox');
  await page.getByRole('tab', { name: 'Scripting' }).click();
  await sandboxToggle.getByRole('switch').waitFor();
  await sandboxToggle.click();
  await expect.soft(sandboxToggle.getByRole('switch')).toBeChecked();
  await page.locator('.app').press('Escape');
  await expect.soft(page.getByTestId('toggle-template-tag-sandbox')).toBeHidden();
};

const sendRequestAndWaitForResponse = async (page: Page, insomnia: any, requestName: string) => {
  await insomnia.navigationSidebar.clickRequestOrFolder(requestName);
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(page.getByRole('button', { name: 'Cancel Request' })).toBeHidden({ timeout: 30_000 });
};

test('response.getBodyBuffer reads only the id-resolved response body, ignoring a paired other-response bodyPath', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  installIdScopeProbePlugin(dataPath);
  await clearPluginToast(page);

  const fixture = await loadFixture('response-getbodybuffer-id-scope-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  // Persist two real, distinct responses so the probe tag has real ids/bodyPaths to reference.
  await sendRequestAndWaitForResponse(page, insomnia, 'self');
  await sendRequestAndWaitForResponse(page, insomnia, 'victim');

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

  // The just-toggled setting needs a moment to propagate to the main process before the tag runs in
  // the sandbox — poll until it does, then assert the caller's own response content is returned, not
  // the paired victim response's. The echo server wraps the body in a JSON envelope (method/headers/
  // data/cookies), so check for the marker as a substring rather than an exact match.
  await expect.poll(() => readTagPreview('{% getbodybufferidprobe'), { timeout: 20_000 }).toContain(SELF_MARKER);
  const finalPreview = await readTagPreview('{% getbodybufferidprobe');
  expect.soft(finalPreview).not.toContain(VICTIM_MARKER);
});
