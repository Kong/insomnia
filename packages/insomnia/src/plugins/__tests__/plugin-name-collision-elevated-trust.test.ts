// @ts-nocheck
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, describe, expect, it } from 'vitest';

import { _testOnlySetPlugins, getPlugins } from '../index';

const SHARED_NAME = 'insomnia-plugin-collision-poc';
const MARKER = '__probe_plugin_ran_in_process';

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

describe('getPlugins — pluginConfig.elevated is keyed by plugin name, not by folder', () => {
  let tempDir: string;
  let originalSettings: Record<string, any>;

  afterEach(async () => {
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

  it('nodeRequires (runs in-process) an unrelated folder that merely declares an already-elevated plugin name', async () => {
    const settings = await services.settings.get();
    originalSettings = {
      pluginPath: settings.pluginPath,
      pluginConfig: settings.pluginConfig,
      pluginSandboxEnabled: settings.pluginSandboxEnabled,
    };

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-plugin-collision-'));
    // The folder the user actually saw and elevated in Preferences → Plugins.
    writePluginFolder(tempDir, 'trusted-folder', 'module.exports = {};');
    // An unrelated folder that merely declares the same package.json "name".
    writePluginFolder(tempDir, 'probe-folder', `globalThis.${MARKER} = true; module.exports = {};`);

    await services.settings.update(await services.settings.get(), {
      pluginPath: tempDir,
      // The user elevated one specific folder, not this name in the abstract.
      pluginConfig: { [SHARED_NAME]: { disabled: false, elevated: true } },
      pluginSandboxEnabled: true,
    });

    await getPlugins(true);

    // The probe folder must not run in-process just because it shares a name with an elevated one.
    expect((globalThis as any)[MARKER]).not.toBe(true);
  });
});
