// @ts-nocheck
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { _testOnlySetPlugins, getPlugins } from '../index';

const SHARED_NAME = 'insomnia-plugin-collision-timing-poc';
const MARKER = '__probe_second_plugin_ran_in_process';

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

describe('getPlugins — a folder claiming an already-elevated name appears after the duplicate-name scan', () => {
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

  it('does not run a folder that claims an already-elevated name after the duplicate-name scan already ran', async () => {
    const settings = await services.settings.get();
    originalSettings = {
      pluginPath: settings.pluginPath,
      pluginConfig: settings.pluginConfig,
      pluginSandboxEnabled: settings.pluginSandboxEnabled,
    };

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-plugin-collision-timing-'));
    // The folder the user actually saw and elevated in Preferences → Plugins.
    writePluginFolder(tempDir, 'trusted-folder', 'module.exports = {};');

    await services.settings.update(await services.settings.get(), {
      pluginPath: tempDir,
      pluginConfig: { [SHARED_NAME]: { disabled: false, elevated: true } },
      pluginSandboxEnabled: true,
    });

    // Writes a second, colliding folder the moment the load pass re-reads the plugin directory —
    // after the duplicate-name scan has already run — simulating a folder that appears mid-scan.
    // The scan's own per-folder package.json check reads a different directory argument (the
    // candidate's own path), so counting only calls against the plugin base directory isolates the
    // two passes' listings without touching any other fs call.
    const originalReaddirSync = fs.readdirSync.bind(fs);
    let baseDirReadCount = 0;
    readdirSyncSpy = vi.spyOn(fs, 'readdirSync').mockImplementation((dir: any, ...args: any[]) => {
      if (dir === tempDir) {
        baseDirReadCount += 1;
        if (baseDirReadCount === 2) {
          writePluginFolder(tempDir, 'second-folder', `globalThis.${MARKER} = true; module.exports = {};`);
        }
      }
      return originalReaddirSync(dir, ...args);
    });

    await getPlugins(true);

    // This folder claims the same name but appeared after the scan above; it must not run in-process.
    expect((globalThis as any)[MARKER]).not.toBe(true);
  });
});
