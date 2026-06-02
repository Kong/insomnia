import fs from 'node:fs';
import path from 'node:path';

import electron from 'electron';
import type { Request, RequestGroup, Workspace } from 'insomnia-data';
import { database as db, models, services } from 'insomnia-data';
import type { PluginConfigMap } from 'insomnia-data/common';

import { fetchFromTemplateWorkerDatabase } from '~/templating/liquid-extension-worker';

import { getAppBundlePlugins, isDevelopment } from '../common/constants';
import * as pluginApp from '../plugins/context/app';
import * as pluginNetwork from '../plugins/context/network';
import * as pluginStore from '../plugins/context/store';
import type { RenderPurpose } from '../templating/types';
import themes from './themes';
import type {
  DocumentAction,
  Plugin,
  RequestAction,
  RequestGroupAction,
  RequestHook,
  ResponseHook,
  TemplateTag,
  Theme,
  WorkspaceAction,
} from './types';

let plugins: Plugin[] | null | undefined = null;

export function _testOnlySetPlugins(p: Plugin[] | null) {
  plugins = p;
}

export async function init() {
  await reloadPlugins();
}

async function traversePluginPath(pluginMap: Record<string, Plugin>, allPaths: string[], allConfigs: PluginConfigMap) {
  for (const p of allPaths) {
    if (!fs.existsSync(p)) {
      continue;
    }
    const folders = (await fs.promises.readdir(p)).filter(f => f.startsWith('insomnia-plugin-'));
    folders.length && console.log('[plugin] Loading', folders.map(f => f.replace('insomnia-plugin-', '')).join(', '));

    for (const filename of fs.readdirSync(p)) {
      try {
        const modulePath = path.resolve(p, filename);
        const packageJSONPath = path.resolve(modulePath, 'package.json');

        // Only read directories
        if (!fs.statSync(modulePath).isDirectory()) {
          continue;
        }

        // Is it a scoped directory?
        if (filename.startsWith('@')) {
          await traversePluginPath(pluginMap, [modulePath], allConfigs);
        }

        // Is it a Node module?
        if (!fs.readdirSync(modulePath).includes('package.json')) {
          continue;
        }

        // Sanitize paths and check for known module patterns to prevent command injection
        const safeModulePath = path.resolve(modulePath);
        // Base directory we're processing from `allPaths`
        const pluginBasePath = p;

        // Check if the resolved module path is inside the base plugin path (to prevent directory traversal)
        if (!safeModulePath.startsWith(pluginBasePath)) {
          console.warn(`[plugin] Ignored potentially unsafe plugin path: ${modulePath}`);
          continue;
        }

        // Now delete the require cache for this module, ensuring we're deleting only the relevant entries
        for (const cachePath of Object.keys(global.require.cache)) {
          // Check if the cache path starts with the safe module path
          if (cachePath.startsWith(safeModulePath)) {
            delete global.require.cache[cachePath];
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
        console.error(`[plugin] Error while loading plugin from ${p}/${filename}:`, err);
      }
    }
  }
}

export async function getPlugins(force = false): Promise<Plugin[]> {
  if (force) {
    plugins = null;
  }

  if (!plugins) {
    const settings = await services.settings.get();
    const allConfigs: PluginConfigMap = settings.pluginConfig;
    const extraPaths = settings.pluginPath
      .split(':')
      .filter(Boolean)
      .map(p => {
        // Ensure proper resolution of paths and avoid path traversal
        if (p.indexOf('~/') === 0) {
          return path.resolve(process.env['HOME'] || '/', p.slice(1));
        }
        return path.resolve(p); // Use resolve to avoid path traversal
      });

    // Make sure the default directories exist
    const pluginPath = path.resolve(
      process.env['INSOMNIA_DATA_PATH'] || (process.type === 'renderer' ? window : electron).app.getPath('userData'),
      'plugins',
    );

    // Also look in node_modules folder in each directory
    const basePaths = [pluginPath, ...extraPaths];
    const extendedPaths = basePaths.map(p => path.resolve(p, 'node_modules'));
    const allPaths = [...basePaths, ...extendedPaths];

    // Store plugins in a map so that plugins with the same name only get added once
    const pluginMap: Record<string, Plugin> = {};
    await traversePluginPath(pluginMap, allPaths, allConfigs);
    const bundlePluginMap = getBundlePluginMap();
    const fullPluginMap = { ...pluginMap, ...bundlePluginMap };
    plugins = Object.keys(fullPluginMap).map(name => fullPluginMap[name]);
  }

  return plugins;
}

function getBundlePluginMap() {
  const appBundlePlugins = getAppBundlePlugins();
  const bundlePluginMap: Record<string, Plugin> = {};
  appBundlePlugins.forEach(({ name: pluginName }) => {
    try {
      const isExecutedInInso = !process.type;
      // In Insomnia, the packagePath is just the pluginName
      let bundlePluginPath = pluginName;
      if (isExecutedInInso) {
        // When executed in Inso, the __dirname points to <packageRoot>/packages/insomnia-inso/dist
        // The bundle plugin module is placed under <packageRoot>/node_module
        const rootNodeModuleDir = path.resolve(__dirname, '..', '..', '..', 'node_modules');
        // use require.resolve to reliably get the absolute path to the plugin's entry point
        bundlePluginPath = require.resolve(pluginName, { paths: [rootNodeModuleDir] });
      }
      console.log('[plugin] Loading bundled plugin %s from %s', pluginName, bundlePluginPath);
      const module = global.require(bundlePluginPath);
      bundlePluginMap[pluginName] = {
        name: pluginName,
        description: `Insomnia bundled plugin for ${pluginName}`,
        version: 'unknown',
        directory: '',
        config: { disabled: false },
        module: module,
      };
    } catch (err) {
      if (isDevelopment()) {
        console.warn(
          `[plugin] Failed to load bundled plugin ${pluginName}. You can ignore this warning if you not developing external vault feature.`,
          err,
        );
      } else {
        console.error(`Failed to load bundled plugin ${pluginName}`, err);
      }
    }
  });
  return bundlePluginMap;
}

export async function reloadPlugins() {
  await getPlugins(true);
}

export async function getActivePlugins(): Promise<Plugin[]> {
  return (await getPlugins()).filter(p => !p.config.disabled);
}

export async function getBundlePlugins(): Promise<Plugin[]> {
  const appBundlePluginNames = getAppBundlePlugins().map(p => p.name);
  return (await getActivePlugins()).filter(p => p.directory === '' && appBundlePluginNames.includes(p.name));
}

export async function getRequestGroupActions(): Promise<RequestGroupAction[]> {
  let extensions: RequestGroupAction[] = [];

  for (const plugin of await getActivePlugins()) {
    const actions = plugin.module.requestGroupActions || [];
    extensions = [
      ...extensions,
      ...actions.map(p => ({
        plugin,
        ...p,
      })),
    ];
  }

  return extensions;
}

export async function getRequestActions(): Promise<RequestAction[]> {
  let extensions: RequestAction[] = [];

  for (const plugin of await getActivePlugins()) {
    const actions = plugin.module.requestActions || [];
    extensions = [
      ...extensions,
      ...actions.map(p => ({
        plugin,
        ...p,
      })),
    ];
  }

  return extensions;
}

export async function getWorkspaceActions(): Promise<WorkspaceAction[]> {
  let extensions: WorkspaceAction[] = [];

  for (const plugin of await getActivePlugins()) {
    const actions = plugin.module.workspaceActions || [];
    extensions = [
      ...extensions,
      ...actions.map(p => ({
        plugin,
        ...p,
      })),
    ];
  }

  return extensions;
}

export async function getDocumentActions(): Promise<DocumentAction[]> {
  let extensions: DocumentAction[] = [];

  for (const plugin of await getActivePlugins()) {
    const actions = plugin.module.documentActions || [];
    extensions = [
      ...extensions,
      ...actions.map(p => ({
        plugin,
        ...p,
      })),
    ];
  }

  return extensions;
}

export async function getTemplateTags(): Promise<TemplateTag[]> {
  let extensions: TemplateTag[] = [];

  for (const plugin of await getActivePlugins()) {
    const templateTags = plugin.module.templateTags || [];
    extensions = [
      ...extensions,
      ...templateTags.map(tt => ({
        plugin,
        templateTag: tt,
      })),
    ];
  }

  return extensions;
}

export function getPluginCommonContext({
  plugin,
  renderPurpose,
}: {
  plugin: Pick<Plugin, 'name'>;
  renderPurpose?: RenderPurpose;
}) {
  return {
    ...pluginApp.init(renderPurpose),
    ...pluginStore.init(plugin),
    ...pluginNetwork.init(),
    util: {
      openInBrowser: async (url: string) =>
        process.type === 'renderer' || process.type === 'worker'
          ? window.main.openInBrowser(url)
          : electron.shell.openExternal(url),
      models: {
        request: {
          getById: services.request.getById,
          getAncestors: async (request: any) => {
            const ancestors = await db.withAncestors<Request | RequestGroup | Workspace>(request, [
              models.requestGroup.type,
              models.workspace.type,
            ]);
            return ancestors.filter(doc => doc._id !== request._id);
          },
        },
        cloudCredential: {
          getById: services.cloudCredential.getById,
          update: services.cloudCredential.update,
        },
        workspace: {
          getById: services.workspace.getById,
        },
        oAuth2Token: {
          getByRequestId: services.oAuth2Token.getByParentId,
        },
        cookieJar: {
          getOrCreateForParentId: (parentId: string) => {
            return services.cookieJar.getOrCreateForParentId(parentId);
          },
        },
        response: {
          getLatestForRequestId: services.response.getLatestForRequestId,
          getBodyBuffer: services.helpers.getResponseBodyBuffer,
        },
        settings: {
          get: services.settings.get,
        },
      },
    },
  };
}

// Allows Insomnia UI to invoke bundled plugin actions from the main process via IPC.
// This entry point is only exposed to bundled plugins, not to public/third‑party plugins.
export async function executePluginMainAction({
  pluginName,
  actionName,
  context,
  params,
}: {
  pluginName: string;
  actionName: string;
  context?: Record<string, any>;
  params?: Record<string, any>;
}): Promise<any> {
  const result = await fetchFromTemplateWorkerDatabase('plugin.executeBundlePluginMainAction', {
    pluginName,
    actionName,
    context,
    params,
  });
  return result;
}

export async function getRequestHooks(): Promise<RequestHook[]> {
  let functions: RequestHook[] = [];

  for (const plugin of await getActivePlugins()) {
    const moreFunctions = plugin.module.requestHooks || [];
    functions = [
      ...functions,
      ...moreFunctions.map(hook => ({
        plugin,
        hook,
      })),
    ];
  }

  return functions;
}

export async function getResponseHooks(): Promise<ResponseHook[]> {
  let functions: ResponseHook[] = [];

  for (const plugin of await getActivePlugins()) {
    const moreFunctions = plugin.module.responseHooks || [];
    functions = [
      ...functions,
      ...moreFunctions.map(hook => ({
        plugin,
        hook,
      })),
    ];
  }

  return functions;
}

export async function getThemes(): Promise<Theme[]> {
  let extensions = themes.map(theme => ({
    plugin: {
      name: theme.name,
      description: 'Built-in themes',
      version: '0.0.0',
      directory: '',
      config: {
        disabled: false,
      },
      module: {},
    },
    theme,
  })) as Theme[];
  for (const plugin of await getActivePlugins()) {
    const themes = plugin.module.themes || [];
    extensions = [
      ...extensions,
      ...themes.map(theme => ({
        plugin,
        theme,
      })),
    ];
  }

  return extensions;
}
