// @ts-nocheck
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { _testOnlySetPlugins, getPlugins } from '../index';

const SHARED_NAME = 'insomnia-plugin-collision-race-poc';
const MARKER = '__probe_plugin_ran_in_process_via_race';

const writePluginFolder = (baseDir: string, folderName: string, indexJs: string) => {
  const dir = path.join(baseDir, folderName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: SHARED_NAME, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  fs.writeFileSync(path.join(dir, 'index.js'), indexJs);
  return dir;
};

describe('getPlugins — a folder claiming an already-elevated name appears mid-scan', () => {
  let tempDir: string;
  let originalSettings: Record<string, any>;
  let readdirSyncSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(async () => {
    readdirSyncSpy?.mockRestore();
    delete (globalThis as any)[MARKER];
    _testOnlySetPlugins(null);
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (originalSettings) {
      await services.settings.update(await services.settings.get(), {
        pluginPath: originalSettings.pluginPath,
        pluginConfig: originalSettings.pluginConfig,
        pluginSandboxEnabled: originalSettings.pluginSandboxEnabled,
      });
    }
  });

  it('a second folder claiming the same name, written after the duplicate-name pre-pass but before the load pass reaches it, must not run in-process', async () => {
    const settings = await services.settings.get();
    originalSettings = {
      pluginPath: settings.pluginPath,
      pluginConfig: settings.pluginConfig,
      pluginSandboxEnabled: settings.pluginSandboxEnabled,
    };

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-plugin-collision-race-'));
    // The folder the user actually saw and elevated in Preferences → Plugins.
    writePluginFolder(tempDir, 'trusted-folder', 'module.exports = {};');

    await services.settings.update(await services.settings.get(), {
      pluginPath: tempDir,
      pluginConfig: { [SHARED_NAME]: { disabled: false, elevated: true } },
      pluginSandboxEnabled: true,
    });

    // Simulates a second folder claiming the same name landing on disk in the window between the
    // duplicate-name pre-pass (one synchronous fs.readdirSync(tempDir) call) and the load pass
    // re-reading the same directory later — the exact sequence an external write racing a
    // Reload/startup scan would produce. The pre-pass's own per-folder package.json existence
    // check reads a *different* directory argument (the candidate's own modulePath), so counting
    // only calls where the argument is the plugin base directory itself isolates the two passes'
    // respective directory listings without needing to touch any other fs call.
    const originalReaddirSync = fs.readdirSync.bind(fs);
    let baseDirReadCount = 0;
    readdirSyncSpy = vi.spyOn(fs, 'readdirSync').mockImplementation((dir: any, ...args: any[]) => {
      if (dir === tempDir) {
        baseDirReadCount += 1;
        if (baseDirReadCount === 2) {
          writePluginFolder(tempDir, 'race-folder', `globalThis.${MARKER} = true; module.exports = {};`);
        }
      }
      return originalReaddirSync(dir, ...args);
    });

    await getPlugins(true);

    // The race-injected folder must not run in-process just because it landed after the
    // duplicate-name pre-pass already recorded this name as unclaimed by more than one folder.
    expect((globalThis as any)[MARKER]).not.toBe(true);
  });
});
