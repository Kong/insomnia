// @flow
import mkdirp from 'mkdirp';
import * as models from '../models';
import fs from 'fs';
import path from 'path';
import { PLUGIN_PATH } from '../common/constants';
import { resolveHomePath } from '../common/misc';
import { showError } from '../ui/components/modals/index';
import type { PluginTemplateTag } from '../templating/extensions/index';
import type { PluginTheme } from './misc';

export type Plugin = {
  name: string,
  description: string,
  version: string,
  directory: string,
  module: *
};

export type TemplateTag = {
  plugin: Plugin,
  templateTag: PluginTemplateTag
};

export type RequestHook = {
  plugin: Plugin,
  hook: Function
};

export type ResponseHook = {
  plugin: Plugin,
  hook: Function
};

export type Theme = {
  plugin: Plugin,
  theme: PluginTheme
};

const CORE_PLUGINS = [
  'insomnia-plugin-base64',
  'insomnia-plugin-hash',
  'insomnia-plugin-file',
  'insomnia-plugin-now',
  'insomnia-plugin-uuid',
  'insomnia-plugin-prompt',
  'insomnia-plugin-request',
  'insomnia-plugin-response',
  'insomnia-plugin-jsonpath',
  'insomnia-plugin-cookie-jar',
  'insomnia-plugin-core-themes'
];

let plugins: ?Array<Plugin> = null;

export async function init(): Promise<void> {
  // Force plugins to load.
  await getPlugins(true);
}

async function _traversePluginPath(pluginMap: Object, allPaths: Array<string>) {
  for (const p of allPaths) {
    if (!fs.existsSync(p)) {
      continue;
    }

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
          await _traversePluginPath(pluginMap, [modulePath]);
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

        // Use global.require() instead of require() because Webpack wraps require()
        const pluginJson = global.require(packageJSONPath);

        // Not an Insomnia plugin because it doesn't have the package.json['insomnia']
        if (!pluginJson.hasOwnProperty('insomnia')) {
          continue;
        }

        // Delete require cache entry and re-require
        const module = global.require(modulePath);

        pluginMap[pluginJson.name] = _initPlugin(
          pluginJson || {},
          module,
          modulePath
        );
        console.log(`[plugin] Loaded ${modulePath}`);
      } catch (err) {
        showError({
          title: 'Plugin Error',
          message: 'Failed to load plugin ' + filename,
          error: err
        });
      }
    }
  }
}

export async function getPlugins(
  force: boolean = false
): Promise<Array<Plugin>> {
  if (force) {
    plugins = null;
  }

  if (!plugins) {
    const settings = await models.settings.getOrCreate();
    const extraPaths = settings.pluginPath
      .split(':')
      .filter(p => p)
      .map(resolveHomePath);

    // Make sure the default directories exist
    mkdirp.sync(PLUGIN_PATH);

    // Also look in node_modules folder in each directory
    const basePaths = [PLUGIN_PATH, ...extraPaths];
    const extendedPaths = basePaths.map(p => path.join(p, 'node_modules'));
    const allPaths = [...basePaths, ...extendedPaths];

    // Store plugins in a map so that plugins with the same
    // name only get added once
    // TODO: Make this more complex and have the latest version always win
    const pluginMap: { [string]: Plugin } = {
      // "name": "module"
    };

    for (const p of CORE_PLUGINS) {
      const pluginJson = global.require(`${p}/package.json`);
      const pluginModule = global.require(p);
      pluginMap[pluginJson.name] = _initPlugin(pluginJson, pluginModule);
    }

    await _traversePluginPath(pluginMap, allPaths);

    plugins = Object.keys(pluginMap).map(name => pluginMap[name]);
  }

  return plugins;
}

export async function getTemplateTags(): Promise<Array<TemplateTag>> {
  let extensions = [];
  for (const plugin of await getPlugins()) {
    const templateTags = plugin.module.templateTags || [];
    extensions = [
      ...extensions,
      ...templateTags.map(tt => ({ plugin, templateTag: tt }))
    ];
  }

  return extensions;
}

export async function getRequestHooks(): Promise<Array<RequestHook>> {
  let functions = [];
  for (const plugin of await getPlugins()) {
    const moreFunctions = plugin.module.requestHooks || [];
    functions = [
      ...functions,
      ...moreFunctions.map(hook => ({ plugin, hook }))
    ];
  }

  return functions;
}

export async function getResponseHooks(): Promise<Array<ResponseHook>> {
  let functions = [];
  for (const plugin of await getPlugins()) {
    const moreFunctions = plugin.module.responseHooks || [];
    functions = [
      ...functions,
      ...moreFunctions.map(hook => ({ plugin, hook }))
    ];
  }

  return functions;
}

export async function getThemes(): Promise<Array<Theme>> {
  let extensions = [];
  for (const plugin of await getPlugins()) {
    const themes = plugin.module.themes || [];
    extensions = [...extensions, ...themes.map(theme => ({ plugin, theme }))];
  }

  return extensions;
}

function _initPlugin(packageJSON: Object, module: any, path: ?string): Plugin {
  const meta = packageJSON.insomnia || {};
  return {
    name: packageJSON.name || meta.name,
    description: packageJSON.description || meta.description || '',
    version: packageJSON.version || 'unknown',
    directory: path || '',
    module: module
  };
}
