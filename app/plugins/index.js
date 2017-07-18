// @flow
import mkdirp from 'mkdirp';
import fs from 'fs';
import path from 'path';
import {PLUGIN_PATHS} from '../common/constants';
import {render} from '../templating';
import skeletonPackageJson from './skeleton/package.json.js';
import skeletonPluginJs from './skeleton/plugin.js.js';

export type Plugin = {
  name: string,
  version: string,
  directory: string,
  module: *
};

export type TemplateTag = {
  plugin: string,
  templateTag: Function
}

export type RequestHook = {
  plugin: string,
  hook: Function
}

export type ResponseHook = {
  plugin: string,
  hook: Function
}

let plugins: ?Array<Plugin> = null;

export function init (): void {
  // Force plugins to load.
  getPlugins(true);
}

export function getPlugins (force: boolean = false): Array<Plugin> {
  if (force) {
    plugins = null;
  }

  if (!plugins) {
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

        const modulePath = path.join(p, dir);
        const packageJSONPath = path.join(modulePath, 'package.json');

        // Use global.require() instead of require() because Webpack wraps require()
        delete global.require.cache[global.require.resolve(packageJSONPath)];
        const pluginJson = global.require(packageJSONPath);

        // Delete require cache entry and re-require
        delete global.require.cache[global.require.resolve(modulePath)];
        const module = global.require(modulePath);

        plugins.push({
          name: pluginJson.name,
          version: pluginJson.version || '0.0.0',
          directory: modulePath,
          module
        });

        // console.log(`[plugin] Loaded ${modulePath}`);
      }
    }
  }

  return plugins;
}

export async function createPlugin (displayName: string): Promise<void> {
  // Create root plugin dir
  const name = displayName.replace(/\s/g, '-').toLowerCase();
  const dir = path.join(PLUGIN_PATHS[0], name);
  mkdirp.sync(dir);

  fs.writeFileSync(path.join(dir, 'plugin.js'), skeletonPluginJs);

  const renderedPackageJson = await render(skeletonPackageJson, {context: {name, displayName}});
  fs.writeFileSync(path.join(dir, 'package.json'), renderedPackageJson);
}

export function getTemplateTags (): Array<TemplateTag> {
  let extensions = [];
  for (const plugin of getPlugins()) {
    const templateTags = plugin.module.templateTags || [];
    extensions = [
      ...extensions,
      ...templateTags.map(tt => ({plugin: plugin.name, templateTag: tt}))
    ];
  }

  return extensions;
}

export function getRequestHooks (): Array<RequestHook> {
  let functions = [];
  for (const plugin of getPlugins()) {
    const moreFunctions = plugin.module.requestHooks || [];
    functions = [
      ...functions,
      ...moreFunctions.map(fn => ({plugin: plugin.name, hook: fn}))
    ];
  }

  return functions;
}

export function getResponseHooks (): Array<ResponseHook> {
  let functions = [];
  for (const plugin of getPlugins()) {
    const moreFunctions = plugin.module.responseHooks || [];
    functions = [
      ...functions,
      ...moreFunctions.map(fn => ({plugin: plugin.name, hook: fn}))
    ];
  }

  return functions;
}
