// Regression coverage for whether a plugin's own module code can reach or mutate another plugin's
// entry in `getPlugins()`'s shared registry. `plugins/index.ts`'s module-scope `plugins` array is
// returned by reference, uncloned, and `resolvePluginExecutionMode` trusts whatever is currently on
// a `Plugin` object's `directory`/`config.elevated` fields — so a live reference to another plugin's
// entry would let one plugin change how the host treats a different plugin. Kept as a permanent
// guard: if the assumption that makes this safe today (esbuild bundling every local module into one
// file, so `getPlugins()` never gets its own `require.cache` entry) ever changes, this file should
// start failing rather than the gap going unnoticed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import electron from 'electron';
import { services } from 'insomnia-data';
import { afterEach, describe, expect, it } from 'vitest';

import { resolvePluginExecutionMode } from '~/common/plugins/sandbox-mode';

import * as pluginsIndexModule from '../index';
import { _testOnlySetPlugins, getPlugins } from '../index';

const MARKER = '__registryReachabilityProbe';

afterEach(async () => {
  delete (globalThis as any)[MARKER];
  _testOnlySetPlugins(null);
});

describe('require.cache enumeration for a live getPlugins() reference', () => {
  afterEach(async () => {
    const settings = await services.settings.get();
    if ((settings as any).__registryReachabilityRestore) {
      await services.settings.update(settings, (settings as any).__registryReachabilityRestore);
    }
  });

  it('finds no getPlugins-shaped export in require.cache for an elevated plugin to enumerate', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-registry-cache-'));
    const pluginName = 'insomnia-plugin-registry-cache-probe';
    const dir = path.join(tempDir, 'probe-folder');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: pluginName, version: '1.0.0', main: 'index.js', insomnia: {} }),
    );
    // Real Node access (this plugin runs elevated): enumerate the real require.cache, look for any
    // cached module whose exports shape matches `plugins/index.ts`'s `getPlugins`, and if one is
    // found, try to flip a different entry's trust fields.
    const realDir = fs.realpathSync(dir);
    fs.writeFileSync(
      path.join(dir, 'index.js'),
      `
        var cachePaths = Object.keys(require.cache);
        var ownFileInCache = cachePaths.some(function (p) { return p.indexOf(${JSON.stringify(realDir)}) === 0; });
        var registryCandidates = cachePaths.filter(function (p) {
          var mod = require.cache[p];
          return mod && mod.exports && typeof mod.exports.getPlugins === 'function';
        });
        var mutationApplied = false;
        registryCandidates.forEach(function (p) {
          try {
            require.cache[p].exports.getPlugins().forEach(function (entry) {
              if (entry && entry.directory && entry.directory.indexOf('other-plugin') !== -1) {
                entry.directory = '';
                mutationApplied = true;
              }
            });
          } catch (e) {}
        });
        globalThis.${MARKER} = { ownFileInCache: ownFileInCache, registryCandidates: registryCandidates, mutationApplied: mutationApplied };
        module.exports = {};
      `,
    );

    const settings = await services.settings.get();
    await services.settings.update(settings, {
      pluginPath: tempDir,
      pluginConfig: { [pluginName]: { disabled: false, elevated: true } },
      pluginSandboxEnabled: true,
      __registryReachabilityRestore: {
        pluginPath: settings.pluginPath,
        pluginConfig: settings.pluginConfig,
        pluginSandboxEnabled: settings.pluginSandboxEnabled,
      },
    } as any);

    await getPlugins(true);

    const result = (globalThis as any)[MARKER];
    // The mechanism genuinely works (the plugin's own file really is in the cache)...
    expect(result.ownFileInCache).toBe(true);
    // ...but `plugins/index.ts` itself is never a separately-cached module in the shipped
    // bundle (esbuild inlines it into `entry.main.min.js`), so there is nothing shaped like
    // `getPlugins` to find, and no mutation is possible through this path.
    expect(result.registryCandidates).toEqual([]);
    expect(result.mutationApplied).toBe(false);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

describe('guessed absolute-path require via electron.app.getAppPath()', () => {
  it('has no getAppPath on the test double', () => {
    expect(typeof (electron.app as any).getAppPath).not.toBe('function');
  });

  const bundlePath = path.resolve(__dirname, '../../../build/entry.main.min.js');
  // Reported as skipped (not a silent pass) when no local production build is present, so a run
  // that never actually exercises the real packaged bundle is visible in the test output rather
  // than looking identical to one that did.
  it.skipIf(!fs.existsSync(bundlePath))('the real packaged bundle refuses to load outside Electron', () => {
    expect(() => require(bundlePath)).toThrow(/Electron/i);
  });

  // Self-contained static evidence for the bundling claim the require.cache test above leans on:
  // that test's empty `registryCandidates` result also occurs under Vitest's own module loader
  // regardless of production bundling (Vitest never routes `plugins/index.ts` through real Node
  // `require.cache` either way), so it can't by itself distinguish "bundled" from "just not
  // required the way Vitest loads it". This checks the actual esbuild config instead: the
  // main-process build's `external` list — the only packages that stay real, separately-`require()`-able
  // modules at runtime — never names this project's own `plugins/index` module, confirming it is
  // always inlined into the single bundle file rather than reachable as its own `require.cache` entry.
  it('esbuild never lists plugins/index as an external (separately-required) module in the main build', () => {
    const esbuildConfigPath = path.resolve(__dirname, '../../../esbuild.entrypoints.ts');
    const config = fs.readFileSync(esbuildConfigPath, 'utf8');

    expect(config).not.toMatch(/external:\s*\[[^\]]*plugins\/index/);
  });
});

describe('registry replacement via a held module-namespace reference', () => {
  it('cannot reassign the real getPlugins export even with a full namespace reference', () => {
    const original = pluginsIndexModule.getPlugins;
    expect(() => {
      (pluginsIndexModule as any).getPlugins = () => [];
    }).toThrow();
    expect(pluginsIndexModule.getPlugins).toBe(original);
  });
});

describe('directory-field mutation impact, assuming a live registry reference were reachable', () => {
  it('would flip resolvePluginExecutionMode to internal if a live registry reference were reachable', () => {
    // `_testOnlySetPlugins` is a test-only backdoor, not a real attack surface — this proves impact
    // only, on the explicit assumption reachability existed (which the tests above rule out).
    const pluginEntry = { directory: '/plugins/other-plugin', config: { elevated: false } };
    expect(resolvePluginExecutionMode({ pluginSandboxEnabled: true }, pluginEntry)).toBe('sandboxed');

    pluginEntry.directory = '';

    expect(resolvePluginExecutionMode({ pluginSandboxEnabled: true }, pluginEntry)).toBe('internal');
  });
});

describe('persistence of a hypothetical mutation across a forced reload', () => {
  afterEach(async () => {
    const settings = await services.settings.get();
    if ((settings as any).__registryReachabilityRestore) {
      await services.settings.update(settings, (settings as any).__registryReachabilityRestore);
    }
  });

  it('does not survive reloadPlugins() — a fresh getPlugins(true) re-derives entries from disk/settings', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-registry-reload-'));
    const pluginName = 'insomnia-plugin-registry-reload-probe';
    const dir = path.join(tempDir, 'probe-folder');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: pluginName, version: '1.0.0', main: 'index.js', insomnia: {} }),
    );
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');

    const settings = await services.settings.get();
    await services.settings.update(settings, {
      pluginPath: tempDir,
      pluginConfig: { [pluginName]: { disabled: false, elevated: true } },
      pluginSandboxEnabled: true,
      __registryReachabilityRestore: {
        pluginPath: settings.pluginPath,
        pluginConfig: settings.pluginConfig,
        pluginSandboxEnabled: settings.pluginSandboxEnabled,
      },
    } as any);

    const [pluginEntry] = await getPlugins(true);
    // Mutate the live cached entry directly (standing in for a hypothetical successful reachability path).
    pluginEntry.directory = '';
    (pluginEntry.config as any).elevated = false;

    const [reloaded] = await pluginsIndexModule.getPlugins(true);

    expect(reloaded).not.toBe(pluginEntry);
    expect(reloaded.directory).not.toBe('');
    expect((reloaded.config as any).elevated).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
