// Regression test for `getPlugins()`'s eager sandbox-engine warm-up
// (`ensureSandboxEngineLoadedBeforePlugins`, ../index.ts, called as the first statement inside
// `getPlugins()`'s `if (!plugins)` block, before `traversePluginPath`/`findDuplicatePluginNames`
// ever run).
//
// The property under test: no plugin folder's own top-level module code — including an `elevated`
// plugin's real, synchronous `nodeRequire()` — can run before the host has already captured the
// sandbox engine module reference. `traversePluginPath` is a plain synchronous
// `for (const filename of fs.readdirSync(p))` loop with no concurrent scheduling, so once the
// warm-up call precedes that loop, ordering no longer depends on which folder a plugin happens to
// occupy (alphabetically first or otherwise) — the capture already happened.
//
// `ensureSandboxEngineLoadedBeforePlugins` only does its warm-up when `!__IS_RENDERER__ &&
// process.type` (i.e. the real Electron main process). Vitest runs as plain Node, where
// `process.type` is undefined, so — matching the existing house pattern in
// `../../runtimes/network/hook-chain-shared-state.test.ts` — this file stubs `process.type` to
// reach the guarded branch at all.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _testOnlySetPlugins, getPlugins } from '../index';

// A real WASM module load has no place in a test about *ordering* — the interception mechanism
// itself is established separately (`plugin-load-order-quickjs-module-resolution.test.ts` and
// `../../templating/sandbox/elevated-plugin-process-access-scope.test.ts`). The stub records into `globalThis` (not
// a module-scope variable) because the plugin fixture below runs through the real `nodeRequire()`
// exercised by `traversePluginPath` and needs a channel visible from that separately-required module.
vi.mock('~/templating/sandbox/quickjs-runtime', () => ({
  getQuickJSModule: () => {
    const markers = ((globalThis as any).__sandboxEnginePreloadOrder ??= []);
    markers.push('quickjs-warm');
    return Promise.resolve({ __stubbedSandboxEngine: true });
  },
}));

const originalProcessType = process.type;

const writePluginFolder = (baseDir: string, folderName: string, pluginName: string, indexJs: string) => {
  const dir = path.join(baseDir, folderName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: pluginName, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  fs.writeFileSync(path.join(dir, 'index.js'), indexJs);
  return dir;
};

describe('getPlugins warms the sandbox engine before any plugin folder\'s own code runs', () => {
  const tempDirs: string[] = [];
  let originalSettings: Record<string, any>;

  beforeEach(() => {
    (process as any).type = 'browser';
    delete (globalThis as any).__sandboxEnginePreloadOrder;
  });

  afterEach(async () => {
    (process as any).type = originalProcessType;
    delete (globalThis as any).__sandboxEnginePreloadOrder;
    _testOnlySetPlugins(null);
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
    if (originalSettings) {
      await services.settings.update(await services.settings.get(), {
        pluginPath: originalSettings.pluginPath,
        pluginConfig: originalSettings.pluginConfig,
        pluginSandboxEnabled: originalSettings.pluginSandboxEnabled,
      });
    }
  });

  // One full "install an elevated plugin, force a reload, observe marker order" cycle. Each call
  // uses a distinct plugin name/folder — real Node's own `require` cache (a separate concern from
  // the ordering guarantee under test) would otherwise mask a second real re-execution of a module
  // already required once in this same process; a fresh module identity sidesteps that without
  // weakening what's being asserted here.
  const loadElevatedProbeAndGetOrder = async (uniqueSuffix: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `insomnia-sandbox-engine-preload-${uniqueSuffix}-`));
    tempDirs.push(dir);
    const pluginName = `insomnia-plugin-preload-order-probe-${uniqueSuffix}`;
    // This plugin's top-level module code — real Node, since it's loaded elevated — pushes its own
    // marker onto the same shared array the mocked warm-up writes to.
    writePluginFolder(
      dir,
      'preload-order-probe-folder',
      pluginName,
      `(globalThis.__sandboxEnginePreloadOrder = globalThis.__sandboxEnginePreloadOrder || []).push('elevated-plugin-loaded');
       module.exports = {};`,
    );

    await services.settings.update(await services.settings.get(), {
      pluginPath: dir,
      pluginConfig: { [pluginName]: { disabled: false, elevated: true } },
      pluginSandboxEnabled: true,
    });

    (globalThis as any).__sandboxEnginePreloadOrder = [];
    _testOnlySetPlugins(null);
    await getPlugins(true);
    return (globalThis as any).__sandboxEnginePreloadOrder;
  };

  it('runs the warm-up before an elevated plugin\'s top-level code, on every forced reload', async () => {
    const settings = await services.settings.get();
    originalSettings = {
      pluginPath: settings.pluginPath,
      pluginConfig: settings.pluginConfig,
      pluginSandboxEnabled: settings.pluginSandboxEnabled,
    };

    // The warm-up marker must appear before the plugin's own marker — never the reverse. If
    // `ensureSandboxEngineLoadedBeforePlugins()`'s call were removed from `getPlugins()` (the
    // pre-fix shape), the elevated plugin's `nodeRequire()` in `traversePluginPath` would be the
    // only thing that ran here, and this array would contain just `['elevated-plugin-loaded']` — this
    // assertion would fail rather than merely being vacuously true.
    expect(await loadElevatedProbeAndGetOrder('first')).toEqual(['quickjs-warm', 'elevated-plugin-loaded']);

    // A second forced reload (fresh plugin identity, same real `getPlugins()`/`traversePluginPath`
    // call path) — proving the ordering isn't a first-call-only fluke (e.g. some one-time
    // process-boot side effect rather than something `getPlugins()` itself guarantees every time).
    expect(await loadElevatedProbeAndGetOrder('second')).toEqual(['quickjs-warm', 'elevated-plugin-loaded']);
  });
});
