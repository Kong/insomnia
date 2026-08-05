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
// events over the page) and dismiss any toast already in flight, before driving the UI. The toast
// can re-render mid-dismiss (its DOM node gets swapped out during its exit transition), which made
// a plain `.click()` here flake: Playwright's actionability wait would see the button go from
// stable -> detached and retry forever, eventually blowing the whole test's timeout. `force: true`
// skips that stability wait (fires the click at whatever is there right now), and the loop is
// bounded by wall-clock time instead of trusting the button count to reach zero.
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

// Enable the sandbox via Preferences → Scripting, then close the modal. The assertions are
// `expect.soft` because this suite's ESLint config (playwright/require-soft-assertions) mandates it;
// soft still *waits* for the switch to flip and the modal to close (serializing the UI), it just
// won't abort here. The authoritative signal that the flag actually took effect is the downstream
// `assertTagPreviewEventually` canary, which polls the rendered output until it reports `sandbox`.
const enableSandbox = async (page: Page) => {
  await page.getByTestId('settings-button').click();
  const sandboxToggle = page.getByTestId('toggle-template-tag-sandbox');
  await page.getByRole('tab', { name: 'Scripting' }).click();
  await sandboxToggle.getByRole('switch').waitFor();
  await sandboxToggle.click();
  await expect.soft(sandboxToggle.getByRole('switch')).toBeChecked();
  await page.locator('.app').press('Escape');
  // Wait for the settings modal to fully close before the caller renders anything.
  await expect.soft(page.getByTestId('toggle-template-tag-sandbox')).toBeHidden();
};

test('Template tag sandbox: flag routes plugin tag execution into the QuickJS sandbox', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  installProbePlugin(dataPath);
  await clearPluginToast(page);

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

// Tag-object source factories (composed into a plugin's templateTags array below).
// A storage round-trip (set then get) — needs the `storage` capability. Under C2 an ungranted
// plugin has no `context.store` branch at all, so it feature-detects and reports that rather than
// throwing — the idiomatic graceful-degradation pattern.
const storageTagObject = (tagName: string) => `{
  name: '${tagName}', displayName: '${tagName}', args: [],
  async run(context) {
    if (!context.store) { return 'no-storage-capability'; }
    await context.store.setItem('cap_k', 'cap-storage-ok');
    return await context.store.getItem('cap_k');
  }
}`;
// A util.render call — baseline (no manifest needed).
const renderTagObject = (tagName: string) => `{
  name: '${tagName}', displayName: '${tagName}', args: [],
  async run(context) {
    try { return await context.util.render('baseline-ok'); } catch (err) { return err.message; }
  }
}`;

test('Template tag sandbox: host capabilities are gated by the manifest (C1 + C2)', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  // Plugin A declares the `storage` capability; plugin B declares nothing. B also exposes a baseline
  // tag (util.render) to prove gating is per-capability, not all-or-nothing.
  writePlugin(
    dataPath,
    'insomnia-plugin-cap-granted',
    { permissions: { capabilities: ['storage'] } },
    `module.exports.templateTags = [${storageTagObject('capstorage')}];`,
  );
  writePlugin(
    dataPath,
    'insomnia-plugin-cap-baseline',
    {},
    `module.exports.templateTags = [${storageTagObject('capdenied')}, ${renderTagObject('capbaseline')}];`,
  );

  await clearPluginToast(page);
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  const fixture = await loadFixture('sandbox-capability-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await enableSandbox(page);

  await insomnia.navigationSidebar.clickRequestOrFolder('Capability Probe');
  await page.getByText('Body', { exact: true }).click();

  const assertTagPreview = async (tagPrefix: string, expected: string) => {
    await page.locator(`[data-template^="${tagPrefix}"]`).click();
    const modal = page.getByRole('dialog');
    await expect.soft(modal.getByLabel('Live Preview')).toContainText(expected);
    await modal.getByRole('button', { name: 'Done' }).click();
    await expect.soft(modal).toBeHidden();
  };

  // Declared `storage` → the set/get round-trip flows end-to-end through the gated bridge.
  await assertTagPreview('{% capstorage', 'cap-storage-ok');
  // Undeclared → `context.store` is absent (C2), so the plugin feature-detects and degrades.
  await assertTagPreview('{% capdenied', 'no-storage-capability');
  // Baseline `render` still works for the same no-manifest plugin — gating is per-capability.
  await assertTagPreview('{% capbaseline', 'baseline-ok');
});

test('Template tag sandbox: surface profile enforces the ceiling and warns manifest-less plugins (P1)', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  // A manifest-less plugin that requires a non-baseline module — the classic pre-sandbox plugin.
  writePlugin(
    dataPath,
    'insomnia-plugin-legacy-migrate',
    {},
    `module.exports.templateTags = [{
      name: 'migrateprobe', displayName: 'migrateprobe', args: [],
      async run() { return typeof require('events').EventEmitter; }
    }];`,
  );
  // A plugin that DECLARES the credentials capability — which is above the template-tag profile
  // ceiling, so it is never granted; the cloudCredential context branch stays absent.
  writePlugin(
    dataPath,
    'insomnia-plugin-ceiling',
    { permissions: { capabilities: ['credentials'] } },
    `module.exports.templateTags = [{
      name: 'ceilingprobe', displayName: 'ceilingprobe', args: [],
      async run(context) { return 'cloudCredential=' + typeof (context.util.models && context.util.models.cloudCredential); }
    }];`,
  );

  await clearPluginToast(page);
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  const fixture = await loadFixture('sandbox-profile-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await enableSandbox(page);

  await insomnia.navigationSidebar.clickRequestOrFolder('Profile Probe');
  await page.getByText('Body', { exact: true }).click();

  const assertTagPreview = async (tagPrefix: string, expected: string) => {
    await page.locator(`[data-template^="${tagPrefix}"]`).click();
    const modal = page.getByRole('dialog');
    await expect.soft(modal.getByLabel('Live Preview')).toContainText(expected);
    await modal.getByRole('button', { name: 'Done' }).click();
    await expect.soft(modal).toBeHidden();
  };

  // Manifest-less plugin requiring a non-baseline module is denied with the exact require message…
  await assertTagPreview('{% migrateprobe', "Module 'events' not permitted by manifest");
  // …and a one-time migration toast surfaces the fix (naming the module + the manifest field).
  await expect.soft(page.getByText('Plugin needs a permissions manifest')).toBeVisible();

  // Ceiling: `credentials` is declared but above the template-tag profile ceiling, so it is not
  // granted — the cloudCredential branch is absent (a manifest can't self-escalate past the surface).
  await assertTagPreview('{% ceilingprobe', 'cloudCredential=undefined');
});

test('Template tag sandbox: vetted npm libraries (uuid, ajv) run when declared (M3)', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  // Declares uuid; a second tag requires ajv WITHOUT declaring it (registry presence ≠ grant).
  writePlugin(
    dataPath,
    'insomnia-plugin-m3-uuid',
    { permissions: { modules: ['uuid'] } },
    `module.exports.templateTags = [
      { name: 'uuidprobe', displayName: 'uuidprobe', args: [], async run() {
        var uuid = require('uuid');
        return 'uuid=' + (uuid.validate(uuid.v4()) ? 'ok' : 'bad');
      } },
      { name: 'ajvungranted', displayName: 'ajvungranted', args: [], async run() { return typeof require('ajv'); } }
    ];`,
  );
  writePlugin(
    dataPath,
    'insomnia-plugin-m3-ajv',
    { permissions: { modules: ['ajv'] } },
    `module.exports.templateTags = [{ name: 'ajvprobe', displayName: 'ajvprobe', args: [], async run() {
      var Ajv = require('ajv');
      var validate = new Ajv().compile({ type: 'object', properties: { n: { type: 'number' } }, required: ['n'] });
      return (validate({ n: 1 }) ? 'valid' : 'invalid') + ',' + (validate({ n: 'x' }) ? 'valid' : 'invalid');
    } }];`,
  );

  await clearPluginToast(page);
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  const fixture = await loadFixture('sandbox-vendored-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await enableSandbox(page);

  await insomnia.navigationSidebar.clickRequestOrFolder('Vendored Probe');
  await page.getByText('Body', { exact: true }).click();

  const assertTagPreview = async (tagPrefix: string, expected: string) => {
    await page.locator(`[data-template^="${tagPrefix}"]`).click();
    const modal = page.getByRole('dialog');
    await expect.soft(modal.getByLabel('Live Preview')).toContainText(expected);
    await modal.getByRole('button', { name: 'Done' }).click();
    await expect.soft(modal).toBeHidden();
  };

  // Declared `uuid` → the bundled lib runs (v4 generated and validated by the same bundle).
  await assertTagPreview('{% uuidprobe', 'uuid=ok');
  // Declared `ajv` → schema compiled and both payloads validated by the bundled lib.
  await assertTagPreview('{% ajvprobe', 'valid,invalid');
  // ajv is IN the registry but this plugin didn't declare it — registry presence ≠ grant.
  await assertTagPreview('{% ajvungranted', "Module 'ajv' not permitted by manifest");
});

// Write an extra file into an already-installed plugin's directory (for multi-file plugins).
const writePluginFile = (dataPath: string, pluginName: string, relPath: string, contents: string) => {
  const abs = path.join(dataPath, 'plugins', pluginName, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
};

test('Template tag sandbox: multi-file plugins resolve relative requires and ignore their node_modules (M4)', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  // A multi-file plugin: entry requires a sibling, a nested file, and a vetted registry lib (uuid).
  writePlugin(
    dataPath,
    'insomnia-plugin-multifile',
    { permissions: { modules: ['uuid'] } },
    // Relative requires are top-level (they resolve at both discovery and sandbox execution); the
    // bare uuid require lives inside run() so plugin discovery (a real nodeRequire in main) doesn't
    // need it on disk — it's a vetted registry module resolved only inside the sandbox.
    `var util = require('./util');
     var helper = require('./nested/helper');
     module.exports.templateTags = [{ name: 'multifileprobe', displayName: 'multifileprobe', args: [], async run() {
       var uuid = require('uuid');
       return util.a() + '|' + helper.b() + '|' + (uuid.validate(uuid.v4()) ? 'id-ok' : 'id-bad');
     } }];`,
  );
  writePluginFile(
    dataPath,
    'insomnia-plugin-multifile',
    'util.js',
    "module.exports.a = function () { return 'util-a'; };",
  );
  writePluginFile(
    dataPath,
    'insomnia-plugin-multifile',
    'nested/helper.js',
    "var deep = require('../util'); module.exports.b = function () { return 'helper-' + deep.a(); };",
  );

  // A plugin that ships its OWN node_modules/uuid returning 'evil' — must never be consulted; the
  // bare require('uuid') resolves to the vetted registry bundle.
  writePlugin(
    dataPath,
    'insomnia-plugin-poison',
    { permissions: { modules: ['uuid'] } },
    // Top-level require('uuid') deliberately resolves to this plugin's OWN fake node_modules/uuid at
    // discovery time (so the plugin loads), but the sandbox — which never reads node_modules — binds
    // the real vetted uuid from the registry. The two disagreeing is exactly the poison guarantee.
    `var uuid = require('uuid');
     module.exports.templateTags = [{ name: 'poisonprobe', displayName: 'poisonprobe', args: [], async run() {
       var id = uuid.v4();
       return id === 'evil' ? 'POISONED' : (uuid.validate(id) ? 'poison-real' : 'poison-bad');
     } }];`,
  );
  writePluginFile(
    dataPath,
    'insomnia-plugin-poison',
    'node_modules/uuid/index.js',
    "module.exports = { v4: function () { return 'evil'; }, validate: function () { return true; } };",
  );

  await clearPluginToast(page);
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  const fixture = await loadFixture('sandbox-multifile-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  await enableSandbox(page);

  await insomnia.navigationSidebar.clickRequestOrFolder('Multi-file Probe');
  await page.getByText('Body', { exact: true }).click();

  const assertTagPreview = async (tagPrefix: string, expected: string) => {
    await page.locator(`[data-template^="${tagPrefix}"]`).click();
    const modal = page.getByRole('dialog');
    await expect.soft(modal.getByLabel('Live Preview')).toContainText(expected);
    await modal.getByRole('button', { name: 'Done' }).click();
    await expect.soft(modal).toBeHidden();
  };

  // Relative requires (sibling + nested + ../) all resolve, and the bare uuid require hits the registry.
  await assertTagPreview('{% multifileprobe', 'util-a|helper-util-a|id-ok');
  // The plugin's own node_modules/uuid ('evil') is never consulted — the real vetted uuid runs.
  await assertTagPreview('{% poisonprobe', 'poison-real');
});

test('Plugin sandbox (L1): installing a user plugin no longer runs its top-level code on the host', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  const SENTINEL_PLUGIN = 'insomnia-plugin-l1-sentinel';
  const sentinelPath = path.join(dataPath, 'plugins', SENTINEL_PLUGIN, 'sentinel.txt');

  // The plugin's TOP-LEVEL code tries to write a file via a Node built-in. With the sandbox off, the
  // loader nodeRequire()s the module on the host, so require('fs') works and the sentinel appears.
  // With the sandbox on, exports are discovered by evaluating the source INSIDE the sandbox, where
  // require('fs') is default-denied — so the write never happens, yet the tag still enumerates + runs.
  // The try/catch keeps discovery from failing on the denied require, so the plugin still loads.
  writePlugin(
    dataPath,
    SENTINEL_PLUGIN,
    {},
    `
      try { require('fs').writeFileSync(__dirname + '/sentinel.txt', 'top-level-ran-on-host'); } catch (e) {}
      module.exports.templateTags = [{
        name: 'l1probe', displayName: 'L1 Probe', description: 'discovery marker', args: [],
        async run() { return 'l1-tag-ran'; },
      }];
    `,
  );

  const fixture = await loadFixture('sandbox-l1-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await clearPluginToast(page);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

  // Flag OFF (default): the loader runs the plugin's top-level code on the host (control).
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());
  expect.soft(fs.existsSync(sentinelPath), 'sandbox off: top-level code runs on the host').toBe(true);

  // Flag ON: re-discover via the sandbox. Poll delete→reload→check so the just-toggled setting has
  // time to propagate to the main process before we conclude the write did not recur.
  await enableSandbox(page);
  await expect
    .poll(
      async () => {
        fs.rmSync(sentinelPath, { force: true });
        await page.evaluate(() => (window as any).main.plugins.reloadPlugins());
        return fs.existsSync(sentinelPath);
      },
      { timeout: 20_000 },
    )
    .toBe(false);

  // Discovery still worked without host execution: the tag enumerates and runs in the sandbox.
  await insomnia.navigationSidebar.clickRequestOrFolder('L1 Probe');
  await page.getByText('Body', { exact: true }).click();
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
  await expect.poll(() => readTagPreview('{% l1probe'), { timeout: 20_000 }).toContain('l1-tag-ran');
});

test('Request hook sandbox (H1): a user plugin request hook runs in the sandbox and mutates the request', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  // The hook injects two headers, and the request targets the echo server, which reflects request
  // headers into the response body. We assert on the header *values* (not names) because the echo
  // lowercases header names but preserves values. X-Ran-In's value is the canary — the sandbox sets
  // INSOMNIA_TEMPLATE_SANDBOX, the legacy in-process path does not — and the values are chosen so
  // neither is a substring of the other (or of the marker), keeping the assertions unambiguous.
  writePlugin(
    dataPath,
    'insomnia-plugin-hook-probe',
    {},
    `
      module.exports.requestHooks = [
        function (context) {
          var ranIn = typeof INSOMNIA_TEMPLATE_SANDBOX !== 'undefined' ? 'ranin-sandboxed' : 'ranin-mainprocess';
          context.request.setHeader('X-Ran-In', ranIn);
          context.request.setHeader('X-Hook-Marker', 'hook-marker-9k2x');
        },
      ];
    `,
  );

  const fixture = await loadFixture('sandbox-hook-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await clearPluginToast(page);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  await insomnia.navigationSidebar.clickRequestOrFolder('Hook Request');
  const responsePane = page.getByTestId('response-pane');

  // Flag OFF (default): the hook runs in-process (control).
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200');
  await expect.soft(responsePane).toContainText('ranin-mainprocess');

  // Flag ON: the same hook now runs in the QuickJS sandbox, still mutating the request. Poll the send
  // so the just-toggled setting has propagated before we assert the sandbox canary.
  await enableSandbox(page);
  await expect
    .poll(
      async () => {
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
        return (await responsePane.textContent()) || '';
      },
      { timeout: 25_000 },
    )
    .toContain('ranin-sandboxed');
  // The second header mutation also round-tripped through the sandbox and reached the wire.
  await expect.soft(responsePane).toContainText('hook-marker-9k2x');
});

test('Response hook sandbox (H1): a user plugin response hook runs in the sandbox and rewrites the body', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  // The response hook overwrites the response body with a canary that reports where it ran (the
  // sandbox sets INSOMNIA_TEMPLATE_SANDBOX). setBody goes through the host bridge (base64) to the
  // response's body file, so the rewritten body shows in the response pane.
  writePlugin(
    dataPath,
    'insomnia-plugin-resp-hook-probe',
    {},
    `
      module.exports.responseHooks = [
        function (context) {
          var ranIn = typeof INSOMNIA_TEMPLATE_SANDBOX !== 'undefined' ? 'ranin-sandboxed' : 'ranin-mainprocess';
          context.response.setBody('resphook-rewrote-body:' + ranIn + ':status-' + context.response.getStatusCode());
        },
      ];
    `,
  );

  const fixture = await loadFixture('sandbox-hook-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await clearPluginToast(page);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  await insomnia.navigationSidebar.clickRequestOrFolder('Hook Request');
  const responsePane = page.getByTestId('response-pane');

  // Flag OFF (default): the response hook runs in-process (control) and rewrites the body.
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200');
  await expect.soft(responsePane).toContainText('resphook-rewrote-body:ranin-mainprocess');

  // Flag ON: the same hook now runs in the QuickJS sandbox; setBody bridges the new body to disk.
  await enableSandbox(page);
  await expect
    .poll(
      async () => {
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
        return (await responsePane.textContent()) || '';
      },
      { timeout: 25_000 },
    )
    .toContain('resphook-rewrote-body:ranin-sandboxed');
});

test('Plugin action sandbox (A1): a user plugin request action runs in the sandbox and its side effect persists', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  // Actions are fire-and-effect — nothing marshals back — so the canary rides the side effect: the
  // request action writes which path executed it (INSOMNIA_TEMPLATE_SANDBOX exists only in the
  // sandbox) plus whether it received the domain models, into plugin storage; a sibling template tag
  // reads that back out. The `storage` capability is declared so context.store is granted on both
  // paths. Canary values are chosen so neither is a substring of the other.
  writePlugin(
    dataPath,
    'insomnia-plugin-action-probe',
    { permissions: { capabilities: ['storage'] } },
    `
      module.exports.requestActions = [
        {
          label: 'Probe Action',
          async action(context, data) {
            var ranIn = typeof INSOMNIA_TEMPLATE_SANDBOX !== 'undefined' ? 'ranin-sandboxed' : 'ranin-mainprocess';
            await context.store.setItem('action_ran_in', ranIn);
            await context.store.setItem('action_req_id', (data && data.request && data.request._id) || 'no-request');
          },
        },
      ];
      module.exports.templateTags = [
        {
          name: 'actionreadback', displayName: 'actionreadback', args: [],
          async run(context) {
            var ranIn = await context.store.getItem('action_ran_in');
            var reqId = await context.store.getItem('action_req_id');
            return (ranIn || 'unset') + '|' + (reqId === 'req-canary-7t3w' ? 'got-req' : 'no-req');
          },
        },
      ];
    `,
  );

  const fixture = await loadFixture('sandbox-action-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await clearPluginToast(page);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  await insomnia.navigationSidebar.clickRequestOrFolder('Action Probe');
  await page.getByText('Body', { exact: true }).click();

  // Fire the request action directly through the plugin bridge (the same call the request-actions
  // dropdown makes), passing domain models so we can prove they reach the action.
  const runAction = () =>
    page.evaluate(() =>
      (window as any).main.plugins.executeAction({
        type: 'request',
        pluginName: 'insomnia-plugin-action-probe',
        label: 'Probe Action',
        projectId: 'proj_action_probe',
        domainData: { request: { _id: 'req-canary-7t3w' } },
      }),
    );

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

  // Flag OFF (default): the action runs in-process (control). Its write is observable via the tag,
  // and the domain models reached it.
  await runAction();
  await expect
    .poll(() => readTagPreview('{% actionreadback'), { timeout: 20_000 })
    .toContain('ranin-mainprocess|got-req');

  // Flag ON: the same action now runs in the QuickJS sandbox (its in-process fn is a throw-stub after
  // discovery, so a successful write proves routing). Poll run+readback so the just-toggled setting
  // has propagated to the main process.
  await enableSandbox(page);
  await expect
    .poll(
      async () => {
        await runAction();
        return readTagPreview('{% actionreadback');
      },
      { timeout: 25_000 },
    )
    .toContain('ranin-sandboxed|got-req');
});

// T1: enable the *new* pluginSandboxEnabled flag (distinct from templateTagSandboxEnabled) via
// Preferences → Scripting. Same soft-assertion + Escape-to-close shape as enableSandbox.
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

// T1: toggle a user plugin's "Full host access" (elevated) in Preferences → Plugins, assert the mode
// indicator reflects the new mode, then close. Toggling pluginConfig triggers a plugin reload (the
// Plugins pane re-discovers on settings.pluginConfig change), so the plugin is re-loaded elevated.
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

test('Plugin sandbox trust flip (T1): pluginSandboxEnabled sandboxes a user plugin; elevating it runs it in-process', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  // One plugin, two surfaces sharing its store: a request action records where it ran (the sandbox
  // marker INSOMNIA_TEMPLATE_SANDBOX exists only in the sandbox), and a template tag reads it back.
  // `storage` is declared so context.store is granted on both the sandboxed and elevated paths.
  writePlugin(
    dataPath,
    'insomnia-plugin-t1-probe',
    { permissions: { capabilities: ['storage'] } },
    `
      module.exports.requestActions = [
        {
          label: 'T1 Probe',
          async action(context) {
            var ranIn = typeof INSOMNIA_TEMPLATE_SANDBOX !== 'undefined' ? 'ranin-sandboxed' : 'ranin-mainprocess';
            await context.store.setItem('t1_ran_in', ranIn);
          },
        },
      ];
      module.exports.templateTags = [
        {
          name: 'actionreadback', displayName: 'actionreadback', args: [],
          async run(context) {
            return (await context.store.getItem('t1_ran_in')) || 'unset';
          },
        },
      ];
    `,
  );

  const fixture = await loadFixture('sandbox-action-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await clearPluginToast(page);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  await insomnia.navigationSidebar.clickRequestOrFolder('Action Probe');
  await page.getByText('Body', { exact: true }).click();

  const runAction = () =>
    page.evaluate(() =>
      (window as any).main.plugins.executeAction({
        type: 'request',
        pluginName: 'insomnia-plugin-t1-probe',
        label: 'T1 Probe',
        projectId: 'proj_t1_probe',
        domainData: {},
      }),
    );

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

  // Turn on the NEW pluginSandboxEnabled flag (the legacy template-tag flag stays off). The user
  // plugin's action must now run in the QuickJS sandbox — proving the new flag drives every surface.
  await enablePluginSandbox(page);
  await expect
    .poll(
      async () => {
        await runAction();
        return readTagPreview('{% actionreadback');
      },
      { timeout: 25_000 },
    )
    .toContain('ranin-sandboxed');

  // Grant this plugin full host access. The mode indicator flips to "Elevated" and the same action
  // now runs in-process (marker absent) — the deliberate, per-plugin escape hatch.
  await setPluginElevated(page, 'insomnia-plugin-t1-probe', 'Elevated');
  await expect
    .poll(
      async () => {
        await runAction();
        return readTagPreview('{% actionreadback');
      },
      { timeout: 25_000 },
    )
    .toContain('ranin-mainprocess');
});

test('A hook throwing a crafted Error cannot self-elevate via a "plugin" property setter', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  // First run (sandbox off) throws once via a poisoned `plugin` setter, attempting to flip its own
  // cached `directory` to '' and pass as trusted; the second run reports where it actually executed.
  writePlugin(
    dataPath,
    'insomnia-plugin-registry-integrity-probe',
    { permissions: { capabilities: ['storage'] } },
    `
      module.exports.requestHooks = [
        async function (context) {
          var alreadyAttempted = await context.store.getItem('poison_attempted');
          if (!alreadyAttempted) {
            await context.store.setItem('poison_attempted', 'yes');
            var err = new Error('poison-attempt');
            Object.defineProperty(err, 'plugin', {
              set: function (assignedPlugin) { assignedPlugin.directory = ''; },
              configurable: true,
            });
            throw err;
          }
          var ranIn = typeof INSOMNIA_TEMPLATE_SANDBOX !== 'undefined' ? 'ranin-sandboxed' : 'ranin-mainprocess';
          context.request.setHeader('X-Ran-In', ranIn);
        },
      ];
    `,
  );

  const fixture = await loadFixture('sandbox-hook-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), fixture);
  await clearPluginToast(page);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  await insomnia.navigationSidebar.clickRequestOrFolder('Hook Request');
  const responsePane = page.getByTestId('response-pane');

  // First send: hook runs in-process (sandbox off) and throws; dismiss the resulting error state.
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await page.waitForURL(/error=/, { timeout: 5000 }).catch(() => {});
  await page.locator('.app').press('Escape').catch(() => {});

  // Enable the sandbox only after the poison attempt, since nothing else forces a plugin reload here.
  await enablePluginSandbox(page);
  await expect
    .poll(
      async () => {
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
        return (await responsePane.textContent()) || '';
      },
      { timeout: 25_000 },
    )
    .toContain('ranin-sandboxed');
});
