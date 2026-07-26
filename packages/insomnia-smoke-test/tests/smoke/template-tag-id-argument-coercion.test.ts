import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

// request.getById sits behind the models.read capability, which is granted to every template tag at
// baseline with no manifest declaration. Its handler forwards a caller-supplied id straight into an
// NeDB query (`db.findOne(type, { _id: id })`); NeDB is a MongoDB-style query engine, so an object
// like `{ $ne: null }` in place of a plain string id is interpreted as a query operator instead of a
// literal value — matching the first document NeDB happens to find rather than one specific record.
// Wrapping the id in String(...) before it reaches the query closes this off (CROSS-TENANT-DB-ACCESS-FINDINGS.md
// Finding 6).

const PLUGIN_NAME = 'insomnia-plugin-id-coercion-probe';

// Installs a template tag with no manifest permissions that calls request.getById with a
// Mongo-operator-shaped payload instead of a plain string id, and reports whether it leaked a real
// document (and which one) or was correctly refused.
const installCoercionProbePlugin = (dataPath: string) => {
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
          name: 'coercionprobe',
          displayName: 'Coercion Probe',
          description: 'Calls request.getById with a Mongo-operator payload instead of a string id',
          args: [],
          async run(context) {
            var result = await context.util.models.request.getById({ '$ne': null });
            return result ? ('LEAKED:' + result._id) : 'NOT_FOUND';
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

test('request.getById coerces a Mongo-operator payload to a string instead of leaking an arbitrary document', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  installCoercionProbePlugin(dataPath);
  await clearPluginToast(page);

  const fixture = (await loadFixture('sandbox-probe-collection.yaml')).replace(
    /\{% sandboxprobe 'e2e' %\}[\s\S]*/,
    "{% coercionprobe %}\n",
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

  // The just-toggled setting needs a moment to propagate to the main process before the tag runs in
  // the sandbox — poll until it does, then assert the operator payload is refused rather than
  // resolving to a real (arbitrary) document.
  await expect.poll(() => readTagPreview('{% coercionprobe'), { timeout: 20_000 }).toBe('NOT_FOUND');
});
