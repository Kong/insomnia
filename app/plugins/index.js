import mkdirp from 'mkdirp';
import fs from 'fs';
import path from 'path';
import {PLUGIN_PATHS} from '../common/constants';
import {render} from '../templating';
import skeletonPackageJson from './skeleton/package.json.js';
import skeletonPluginJs from './skeleton/plugin.js.js';

let plugins = null;

export async function init () {
  // Force plugins to load.
  getPlugins(true);
}

export function getPlugins (force = false) {
  if (!plugins || force) {
    // Make sure the directories exist
    for (const p of PLUGIN_PATHS) {
      mkdirp.sync(p);
    }

    plugins = [];
    for (const p of PLUGIN_PATHS) {
      for (const dir of fs.readdirSync(p)) {
        if (dir.indexOf('.') === 0) {
          continue;
        }

        const moduleDirectory = path.join(p, dir);

        // Use global.require() instead of require() because Webpack wraps require()
        const pluginJson = global.require(path.join(moduleDirectory, 'package.json'));
        const module = global.require(moduleDirectory);

        plugins.push({
          name: pluginJson.name,
          version: pluginJson.version || '0.0.0',
          directory: moduleDirectory,
          module
        });
      }
    }
  }

  return plugins;
}

export async function createPlugin (displayName) {
  // Create root plugin dir
  const name = displayName.replace(/\s/g, '-').toLowerCase();
  const dir = path.join(PLUGIN_PATHS[0], name);
  mkdirp.sync(dir);

  fs.writeFileSync(path.join(dir, 'plugin.js'), skeletonPluginJs);

  const renderedPackageJson = await render(skeletonPackageJson, {context: {name, displayName}});
  fs.writeFileSync(path.join(dir, 'package.json'), renderedPackageJson);
}

export function getTemplateTags () {
  let extensions = [];
  for (const plugin of getPlugins()) {
    const templateTags = plugin.module.templateTags || [];
    extensions = [...extensions, ...templateTags];
  }

  return extensions;
}
