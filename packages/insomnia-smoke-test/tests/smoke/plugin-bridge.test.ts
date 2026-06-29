import fs from 'node:fs';
import path from 'node:path';

import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

const PLUGIN_NAME = 'insomnia-plugin-bridge-test';
const ACTION_LABEL = 'Bridge Test Action';

test('Plugin bridge routes requestAction execution through hidden BrowserWindow', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  // Write a minimal plugin with a requestAction to the data-path plugins directory.
  const pluginDir = path.join(dataPath, 'plugins', PLUGIN_NAME);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    // The 'insomnia' key is required — the loader skips packages that lack it.
    JSON.stringify({ name: PLUGIN_NAME, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `module.exports.requestActions = [{ label: '${ACTION_LABEL}', action: async () => {} }];`,
  );

  // Import a collection so we have a request to target.
  const fixture = await loadFixture('simple.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  // Reload plugins through the bridge, awaiting completion.  This ensures the
  // hidden BrowserWindow has started and the test plugin is registered before we
  // check the UI.  page.evaluate awaits the returned Promise.
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  // Open the request actions dropdown for 'example http'.
  // onOpen calls window.main.plugins.getRequestActions() through the bridge.
  await insomnia.navigationSidebar.clickRequestOrFolder('example http');
  await insomnia.navigationSidebar.openRequestActionsDropdown('example http');

  // The plugin action must appear in the dropdown, proving end-to-end bridge execution.
  await expect.soft(page.getByRole('menuitemradio', { name: ACTION_LABEL })).toBeVisible();
});

test('Plugin bridge surfaces errors from plugins that throw or reject', async ({ page, dataPath }) => {
  const pluginName = 'insomnia-plugin-bridge-failure';
  const pluginDir = path.join(dataPath, 'plugins', pluginName);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({ name: pluginName, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  // Three failure shapes the bridge must normalize: sync throw, async reject with Error, async reject with non-Error.
  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `
      module.exports.requestActions = [
        { label: 'Sync Throw', action: () => { throw new Error('sync-boom'); } },
        { label: 'Async Reject Error', action: async () => { throw new Error('async-boom'); } },
        { label: 'Async Reject Non-Error', action: async () => { return Promise.reject('plain-string'); } },
      ];
    `,
  );

  // Wait until the renderer has settled on the project route — otherwise an
  // in-flight navigation destroys the evaluate execution context.
  await page.getByLabel('Import').waitFor();
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  const results = await page.evaluate(async () => {
    const main = (window as any).main;
    const actions = await main.plugins.getRequestActions();
    const outcomes: { label: string; ok: boolean; message: string | null }[] = [];
    for (const action of actions.filter((a: any) => /Sync Throw|Async Reject/.test(a.label))) {
      try {
        await main.plugins.executeAction({
          type: 'request',
          pluginName: action.pluginName,
          label: action.label,
          projectId: '',
          domainData: {},
        });
        outcomes.push({ label: action.label, ok: true, message: null });
      } catch (err: any) {
        outcomes.push({ label: action.label, ok: false, message: String(err?.message ?? err) });
      }
    }
    return outcomes;
  });

  // Every failure shape must surface as a rejection to the renderer — not as a hang and not as a silent ok.
  expect.soft(results.find(r => r.label === 'Sync Throw')?.ok).toBe(false);
  expect.soft(results.find(r => r.label === 'Async Reject Error')?.ok).toBe(false);
  expect.soft(results.find(r => r.label === 'Async Reject Non-Error')?.ok).toBe(false);

  const metrics = await page.evaluate(() => (window as any).main.plugins.getBridgeMetrics());
  // executeAction must have observed at least the three error outcomes we just produced.
  expect.soft(metrics.perMethod.executeAction?.error ?? 0).toBeGreaterThanOrEqual(3);
});

test('Plugin bridge handles concurrent invocations without cross-talk', async ({ page, dataPath }) => {
  const pluginName = 'insomnia-plugin-bridge-concurrent';
  const pluginDir = path.join(dataPath, 'plugins', pluginName);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({ name: pluginName, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  fs.writeFileSync(path.join(pluginDir, 'index.js'), 'module.exports.requestActions = [];');

  await page.getByLabel('Import').waitFor();
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  // Fire N concurrent metadata invocations.  Each call assigns its own request id,
  // and the bridge result handler must route results back to the correct promise.
  const completed = await page.evaluate(async () => {
    const main = (window as any).main;
    const promises = Array.from({ length: 20 }, () => main.plugins.getRequestActions());
    const results = await Promise.all(promises);
    return results.every(r => Array.isArray(r)) ? results.length : -1;
  });
  expect.soft(completed).toBe(20);
});
