import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

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
            // The sandbox sets INSOMNIA_TEMPLATE_SANDBOX; the legacy main-process path does not.
            // (process now exists in both — the sandbox provides a stub — so it can't be the signal.)
            const ranIn = typeof INSOMNIA_TEMPLATE_SANDBOX !== 'undefined' ? 'sandbox' : 'main-process';
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
        {
          name: 'stdlibprobe',
          displayName: 'Stdlib Probe',
          description: 'Exercises ambient globals (Buffer/URL/process/crypto) for parity + escape checks',
          args: [{ displayName: 'API', type: 'string', defaultValue: 'buffer' }],
          async run(context, api = 'buffer') {
            if (api === 'buffer') {
              return Buffer.from('hi 👋').toString('base64');
            }
            if (api === 'url') {
              const u = new URL('https://user@example.com:8443/p?a=1#h');
              return [u.hostname, u.port, u.pathname, u.search, u.origin].join('|');
            }
            if (api === 'querystring') {
              const p = new URLSearchParams('a=1&b=two');
              return p.get('a') + ',' + p.get('b');
            }
            if (api === 'platform') {
              return process.platform;
            }
            if (api === 'subtle') {
              const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('insomnia'));
              const bytes = new Uint8Array(buf);
              let hex = '';
              for (let i = 0; i < bytes.length; i++) {
                hex += ('0' + bytes[i].toString(16)).slice(-2);
              }
              return hex;
            }
            if (api === 'env') {
              return JSON.stringify(process.env);
            }
            if (api === 'frozen') {
              return String(Object.isFrozen(process));
            }
            return 'unknown-api';
          },
        },
      ];
    `,
  );
};

// Write an arbitrary inline plugin (package.json + index.js) into the data-path plugins directory.
const writePlugin = (dataPath: string, name: string, insomnia: unknown, indexJs: string) => {
  const pluginDir = path.join(dataPath, 'plugins', name);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({ name, version: '1.0.0', main: 'index.js', insomnia }),
  );
  fs.writeFileSync(path.join(pluginDir, 'index.js'), indexJs);
};

// Seed the once-only guard for the persistent "Plugin system updated" toast (it intercepts pointer
// events over the page) and dismiss any toast already in flight, before driving the UI.
const clearPluginToast = async (page: Page) => {
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
};

// Enable the sandbox via Preferences → Scripting, then close the modal. Hard-asserts the switch
// flipped on (a missed click must fail here, not silently leave tags on the legacy path).
const enableSandbox = async (page: Page) => {
  await page.getByTestId('settings-button').click();
  const sandboxToggle = page.getByTestId('toggle-template-tag-sandbox');
  await page.getByRole('tab', { name: 'Scripting' }).click();
  await sandboxToggle.getByRole('switch').waitFor();
  await sandboxToggle.click();
  await expect.soft(sandboxToggle.getByRole('switch')).toBeChecked();
  await page.locator('.app').press('Escape');
  // Ensure the settings modal has fully closed before the caller renders anything.
  await expect.soft(page.getByTestId('toggle-template-tag-sandbox')).toBeHidden();
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
    // Wait for the editor to fully close — otherwise a still-open dialog (e.g. after an async tag
    // render) intercepts the next interaction, which can silently swallow the settings toggle.
    await expect.soft(modal).toBeHidden();
  };

  // Read a tag's rendered Live Preview value (used to compare flag-off vs flag-on parity).
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

  // The tag editor renders once per open, so a preview opened before a just-changed setting has
  // propagated to the main process (where the sandbox flag is read) stays stale. Re-open the pill
  // each poll until the output reflects the new flag.
  const assertTagPreviewEventually = async (tagPrefix: string, expected: string) => {
    await expect.poll(() => readTagPreview(tagPrefix), { timeout: 20_000 }).toContain(expected);
  };

  const expectedHash = crypto.createHash('sha256').update('insomnia-test').digest('hex');
  // M2 stdlib APIs whose output must be byte-identical between the legacy path and the sandbox.
  const parityApis = ['buffer', 'url', 'querystring', 'platform', 'subtle'] as const;

  // Flag off (default): tags run on the legacy main-process path. Capture the stdlib outputs here
  // so we can assert the sandbox reproduces them byte-for-byte once the flag is on.
  await assertTagPreview('{% sandboxprobe', 'e2e | ran in: main-process');
  await assertTagPreview('{% cryptoparity', expectedHash);
  const legacyStdlib: Record<string, string> = {};
  for (const api of parityApis) {
    legacyStdlib[api] = await readTagPreview(`{% stdlibprobe '${api}'`);
  }

  // Toggle the sandbox on (Preferences → Scripting). enableSandbox hard-asserts the switch flips,
  // so a missed click fails here loudly instead of silently rendering on the legacy path below.
  await enableSandbox(page);

  // Canary: the same tag now reports sandbox execution, and the async host bridge still round-trips.
  // Derive the expected arch from the Electron main process (where pluginToMainAPI runs) rather
  // than the Playwright runner, which can differ in cross-arch setups. Poll (re-opening the pill)
  // so the just-toggled flag has time to propagate to the main process before we assert on it.
  const electronArch = await app.evaluate(() => process.arch);
  await assertTagPreviewEventually('{% sandboxprobe', `e2e | ran in: sandbox | arch via bridge: ${electronArch}`);

  // Parity: the sandboxed require('crypto') workload is byte-identical to the legacy render above.
  await assertTagPreview('{% cryptoparity', expectedHash);

  // Module gating (M1): the baseline grant resolves through the registry, while anything outside
  // it — npm packages and raw Node builtins alike — fails with the exact manifest denial message
  // that tells a plugin author what to declare.
  await assertTagPreview("{% requireprobe 'path'", 'a/b');
  await assertTagPreview("{% requireprobe 'left-pad'", "Module 'left-pad' not permitted by manifest");
  await assertTagPreview("{% requireprobe 'fs'", "Module 'fs' not permitted by manifest");

  // Sandbox stdlib (M2): the ambient globals (Buffer/URL/URLSearchParams/process.platform/
  // crypto.subtle) produce byte-identical output to the legacy Node path they replace.
  for (const api of parityApis) {
    expect.soft(await readTagPreview(`{% stdlibprobe '${api}'`), `stdlib '${api}' parity`).toBe(legacyStdlib[api]);
  }
  // subtle.digest is also pinned to a known value (guards against both paths sharing a bug).
  expect.soft(legacyStdlib.subtle).toBe(crypto.createHash('sha256').update('insomnia').digest('hex'));

  // Escape checks — sandbox-only (the legacy path has a real, unfrozen process): the process stub
  // exposes no host environment and is frozen.
  await assertTagPreview("{% stdlibprobe 'env'", '{}');
  await assertTagPreview("{% stdlibprobe 'frozen'", 'true');
});

// The tag body used by both manifest plugins: require('events') and prove EventEmitter works, or
// report the failure. Its outcome depends solely on whether the owning plugin declared the grant.
const eventsTagBody = (tagName: string) => `
  module.exports.templateTags = [{
    name: '${tagName}',
    displayName: '${tagName}',
    args: [],
    async run() {
      try {
        var E = require('events').EventEmitter;
        var e = new E();
        var out = '';
        e.on('x', function (v) { out = v; });
        e.emit('x', 'events-ok');
        return out;
      } catch (err) {
        return err.message;
      }
    }
  }];`;

test('Template tag sandbox: manifest grants a non-baseline module and is shown in the Plugins pane', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  // Plugin A declares `events`; plugin B declares nothing; plugin C's permissions block is malformed.
  writePlugin(
    dataPath,
    'insomnia-plugin-events-granted',
    { permissions: { modules: ['events'] } },
    eventsTagBody('eventsgranted'),
  );
  writePlugin(dataPath, 'insomnia-plugin-events-baseline', {}, eventsTagBody('eventsbaseline'));
  writePlugin(
    dataPath,
    'insomnia-plugin-events-malformed',
    { permissions: { modules: 'events' } },
    eventsTagBody('eventsmalformed'),
  );

  await clearPluginToast(page);
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  const fixture = await loadFixture('sandbox-manifest-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await enableSandbox(page);

  await insomnia.navigationSidebar.clickRequestOrFolder('Manifest Probe');
  await page.getByText('Body', { exact: true }).click();

  const assertTagPreview = async (tagPrefix: string, expected: string) => {
    await page.locator(`[data-template^="${tagPrefix}"]`).click();
    const modal = page.getByRole('dialog');
    await expect.soft(modal.getByLabel('Live Preview')).toContainText(expected);
    await modal.getByRole('button', { name: 'Done' }).click();
  };

  // A plugin that declared `events` can construct an EventEmitter; an undeclared one is denied with
  // the exact manifest message. (The grant working at all also proves the sandbox flag applied.)
  await assertTagPreview('{% eventsgranted', 'events-ok');
  await assertTagPreview('{% eventsbaseline', "Module 'events' not permitted by manifest");

  // Preferences → Plugins surfaces each plugin's declared permissions, and flags the malformed one.
  await page.getByTestId('settings-button').click();
  await page.locator('div[role="tab"]:has-text("Plugins")').click();

  await expect
    .soft(page.getByTestId('plugin-permissions-insomnia-plugin-events-granted'))
    .toContainText('modules: events');
  await expect
    .soft(page.getByTestId('plugin-permissions-insomnia-plugin-events-baseline'))
    .toContainText('baseline access');
  // Malformed manifest degrades to baseline AND surfaces a validation warning — never crashes the loader.
  await expect
    .soft(page.getByTestId('plugin-permissions-insomnia-plugin-events-malformed'))
    .toContainText('baseline access');
  await expect.soft(page.getByTestId('plugin-permission-warning-insomnia-plugin-events-malformed')).toBeVisible();
});
