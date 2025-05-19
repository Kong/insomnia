import electron from 'electron';
import fs from 'fs';
import path from 'path';

import type { PluginConfigMap } from '../common/settings';
import * as models from '../models';
import { showError } from '../ui/components/modals/index';

let plugins: Plugin[] | null | undefined = null;

async function _traversePluginPath(pluginMap: Record<string, Plugin>, allPaths: string[], allConfigs: PluginConfigMap) {
  for (const p of allPaths) {
    if (!fs.existsSync(p)) {
      continue;
    }
    const folders = (await fs.promises.readdir(p)).filter(f => f.startsWith('insomnia-plugin-'));
    folders.length && console.log('[plugin] Loading', folders.map(f => f.replace('insomnia-plugin-', '')).join(', '));
    for (const filename of fs.readdirSync(p)) {
      try {
        const modulePath = path.join(p, filename);
        const packageJSONPath = path.join(modulePath, 'package.json');

        // Only read directories
        if (!fs.statSync(modulePath).isDirectory()) {
          continue;
        }

        // Is it a scoped directory?
        if (filename.startsWith('@')) {
          await _traversePluginPath(pluginMap, [modulePath], allConfigs);
        }

        // Is it a Node module?
        if (!fs.readdirSync(modulePath).includes('package.json')) {
          continue;
        }

        // Delete `require` cache if plugin has been required before
        for (const p of Object.keys(global.require.cache)) {
          if (p.indexOf(modulePath) === 0) {
            delete global.require.cache[p];
          }
        }

        const pluginJson = global.require(packageJSONPath);

        // Not an Insomnia plugin because it doesn't have the package.json['insomnia']
        if (!('insomnia' in pluginJson)) {
          continue;
        }

        // Delete require cache entry and re-require
        const module = global.require(modulePath);

        pluginMap[pluginJson.name] = {
          name: pluginJson.name,
          description: pluginJson.description || pluginJson.insomnia.description || '',
          version: pluginJson.version || 'unknown',
          directory: modulePath || '',
          config: pluginJson.name in allConfigs ? allConfigs[pluginJson.name] : { disabled: false },
          module: module,
        };
      } catch (err) {
        showError({
          title: 'Plugin Error',
          message:
            'Failed to load plugin ' +
            filename +
            '. Please contact the plugin author sharing the below stack trace to help them to ensure compatibility with the latest Insomnia.',
          error: err,
        });
      }
    }
  }
}

export async function getPlugins(force = false): Promise<Plugin[]> {
  if (force) {
    plugins = null;
  }

  if (!plugins) {
    const settings = await models.settings.get();
    const allConfigs: PluginConfigMap = settings.pluginConfig;
    const extraPaths = settings.pluginPath
      .split(':')
      .filter(p => p)
      .map(p => {
        if (p.indexOf('~/') === 0) {
          return path.join(process.env['HOME'] || '/', p.slice(1));
        }
        return p;
      });
    // Make sure the default directories exist
    const pluginPath = path.join(
      process.env['INSOMNIA_DATA_PATH'] || (process.type === 'renderer' ? window : electron).app.getPath('userData'),
      'plugins',
    );
    fs.mkdirSync(pluginPath, { recursive: true });
    // Also look in node_modules folder in each directory
    const basePaths = [pluginPath, ...extraPaths];
    const extendedPaths = basePaths.map(p => path.join(p, 'node_modules'));
    const allPaths = [...basePaths, ...extendedPaths];
    // Store plugins in a map so that plugins with the same
    // name only get added once
    // TODO: Make this more complex and have the latest version always win
    const pluginMap: Record<string, Plugin> = {
      // "name": "module"
    };

    await _traversePluginPath(pluginMap, allPaths, allConfigs);
    plugins = Object.keys(pluginMap).map(name => pluginMap[name]);
  }

  return plugins;
}
