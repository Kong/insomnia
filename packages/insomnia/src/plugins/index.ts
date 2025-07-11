import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import electron from 'electron';

import type { ParsedApiSpec } from '../common/api-specs';
import { getAppBundlePlugins, isDevelopment } from '../common/constants';
import { database as db } from '../common/database';
import type { PluginConfigMap } from '../common/settings';
import * as models from '../models';
import type { GrpcRequest } from '../models/grpc-request';
import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { SocketIORequest } from '../models/socket-io-request';
import type { WebSocketRequest } from '../models/websocket-request';
import type { Workspace } from '../models/workspace';
import type { PluginTemplateTag } from '../templating/types';
import { insomniaFetch } from '../ui/insomniaFetch';
import { isValidJSONString } from '../utils/string-check';
import { buildQueryStringFromParams } from '../utils/url/querystring';
import type { PluginTheme } from './misc';
import themes from './themes';

export interface Plugin {
  name: string;
  description: string;
  version: string;
  directory: string;
  config: { disabled: boolean };
  module: {
    templateTags?: PluginTemplateTag[];
    requestHooks?: ((requestContext: any) => void)[];
    responseHooks?: ((responseContext: any) => void)[];
    themes?: PluginTheme[];
    requestGroupActions?: OmitInternal<RequestGroupAction>[];
    requestActions?: OmitInternal<RequestAction>[];
    workspaceActions?: OmitInternal<WorkspaceAction>[];
    documentActions?: OmitInternal<DocumentAction>[];
    pluginRouterActions?: OmitInternal<PluginAction>[];
  };
}

type OmitInternal<T> = Omit<T, keyof { plugin: Plugin }>;
export type TemplateTag = { plugin: Plugin } & {
  templateTag: PluginTemplateTag;
};

export type RequestGroupAction = { plugin: Plugin } & {
  action: (
    context: Record<string, any>,
    models: {
      requestGroup: RequestGroup;
      requests: (Request | GrpcRequest | WebSocketRequest)[];
    },
  ) => void | Promise<void>;
  label: string;
  icon?: string;
};

export type RequestAction = { plugin: Plugin } & {
  action: (
    context: Record<string, any>,
    models: {
      requestGroup?: RequestGroup;
      request: Request | GrpcRequest | WebSocketRequest | SocketIORequest;
    },
  ) => void | Promise<void>;
  label: string;
  icon?: string;
};

export type WorkspaceAction = { plugin: Plugin } & {
  action: (
    context: Record<string, any>,
    models: {
      workspace: Workspace;
      requestGroups: RequestGroup[];
      requests: Request[];
    },
  ) => void | Promise<void>;
  label: string;
  icon?: string;
};

export type DocumentAction = { plugin: Plugin } & {
  action: (context: Record<string, any>, documents: ParsedApiSpec) => void | Promise<void>;
  label: string;
  hideAfterClick?: boolean;
};

export type PluginAction = { plugin: Plugin } & {
  name: string;
  description?: string;
  action: (context: Record<string, any>, params?: any) => Promise<any>;
};

type RequestHookCallback = (context: any) => void;

export type RequestHook = { plugin: Plugin } & {
  hook: RequestHookCallback;
};

type ResponseHookCallback = (context: any) => void;
export type ResponseHook = { plugin: Plugin } & {
  hook: ResponseHookCallback;
};

export type Theme = { plugin: Plugin } & {
  theme: PluginTheme;
};

export type ColorScheme = 'default' | 'light' | 'dark';

let plugins: Plugin[] | null | undefined = null;

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
        const bundlePluginPath = getPreBundlePluginPath();

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

        const isExecutedInApp = process.type === 'renderer' || process.type === 'worker' || process.type === 'browser';
        // Validate bundle plugin checksum for production builds
        if (isDevelopment() && pluginBasePath.startsWith(bundlePluginPath) && isExecutedInApp) {
          let pluginChecksum = null;
          const appBundlePlugins = getAppBundlePlugins();
          const { name: pluginName, version: pluginVersion } = pluginJson;
          // Check if the plugin is a pre-bundle plugin
          const isBundlePlugin = appBundlePlugins.some(p => p.name === pluginName);
          if (!isBundlePlugin) {
            console.warn(`[plugin] Ignored unknown bundle plugin from path: ${modulePath}`);
            continue;
          }
          try {
            const { id: sessionId, accountId } = await models.userSession.getOrCreate();
            const planType = JSON.parse(localStorage.getItem(`${accountId}:currentPlan`) || '{}').type;
            if (!planType.includes('enterprise')) {
              continue;
            }
            //Get bundle plugin checksum
            const urlParams = buildQueryStringFromParams([
              { name: 'pluginName', value: pluginName },
              { name: 'pluginVersion', value: pluginVersion },
            ]);
            const { checksum } = await insomniaFetch<{ checksum: string }>({
              method: 'GET',
              path: `/v1/enterprise/plugin-checksum?${urlParams}`,
              sessionId,
              onlyResolveOnSuccess: true,
            });
            if (isValidJSONString(checksum)) {
              pluginChecksum = JSON.parse(checksum);
            }
          } catch (err) {
            console.warn(`[plugin] Failed to get bundle plugin checksum: ${err.message}`);
            continue;
          }
          if (!pluginChecksum) {
            console.warn(`[plugin] Ignored bundle plugin ${pluginName} because the checksum is not available`);
            continue;
          }
          // traverse all files in the plugin directory and calculate the checksum
          const checksumFileRelativePaths = Object.keys(pluginChecksum);
          let isSafePluginBundle = true;
          for (const relativePath of checksumFileRelativePaths) {
            const filePath = path.resolve(modulePath, relativePath);
            if (!fs.existsSync(filePath)) {
              console.warn(`[plugin] Ignored missing file in bundle plugin: ${filePath}`);
              isSafePluginBundle = false;
              break;
            }
            const fileContent = fs.readFileSync(filePath);
            const hashAlgorithm = pluginChecksum[relativePath].startsWith('sha512-') ? 'sha512' : 'sha256';
            const calculatedChecksum = crypto.createHash(hashAlgorithm).update(fileContent).digest('base64');
            if (`${hashAlgorithm}-${calculatedChecksum}` !== pluginChecksum[relativePath]) {
              console.warn(
                `[plugin] Ignored bundle plugin ${pluginName} because the checksum for ${filePath} does not match`,
              );
              isSafePluginBundle = false;
              break;
            }
          }
          if (!isSafePluginBundle) {
            continue;
          }
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
    const settings = await models.settings.get();
    const allConfigs: PluginConfigMap = settings.pluginConfig;
    const extraPaths = settings.pluginPath
      .split(':')
      .filter(p => p)
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
    // pre-bundle plugins under app path
    const preBundlePluginPath = getPreBundlePluginPath();
    fs.mkdirSync(pluginPath, { recursive: true });

    // Also look in node_modules folder in each directory
    const basePaths = [pluginPath, preBundlePluginPath, ...extraPaths];
    const extendedPaths = basePaths.map(p => path.resolve(p, 'node_modules'));
    const allPaths = [...basePaths, ...extendedPaths];

    // Store plugins in a map so that plugins with the same name only get added once
    const pluginMap: Record<string, Plugin> = {};
    await traversePluginPath(pluginMap, allPaths, allConfigs);

    plugins = Object.keys(pluginMap).map(name => pluginMap[name]);
  }

  return plugins;
}

export function getPreBundlePluginPath() {
  const pluginDirRelativePath = isDevelopment() ? './plugins' : '../plugins';
  return path.resolve(
    process.env['INSOMNIA_APP_PATH'] || (process.type === 'renderer' ? window : electron).app.getAppPath(),
    pluginDirRelativePath,
  );
}

export async function reloadPlugins() {
  await getPlugins(true);
}

export async function getActivePlugins(): Promise<Plugin[]> {
  return (await getPlugins()).filter(p => !p.config.disabled);
}

export async function getActiveBundlePlugins(): Promise<Plugin[]> {
  const preBundlePluginPath = getPreBundlePluginPath();
  return (await getActivePlugins()).filter(p => p.directory.startsWith(preBundlePluginPath));
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

export async function isPreBundlePluginTemplateTag(input: string) {
  if (!input.includes('{%')) {
    return false;
  }
  const bunelPluginNames = getAppBundlePlugins().map(p => p.name);
  const activePlugins = await getActiveBundlePlugins();
  return activePlugins
    .filter(plugin => bunelPluginNames.includes(plugin.name))
    .some(plugin => {
      const templateTags = plugin.module.templateTags || [];
      const tagNames = templateTags.map(tt => tt.name);
      return tagNames.some(tagName => input.match(new RegExp(`^{% *${tagName} *.+`)));
    });
}

export async function getPluginRouterActions(): Promise<PluginAction[]> {
  let extensions: PluginAction[] = [];

  for (const plugin of await getActivePlugins()) {
    const actions = plugin.module.pluginRouterActions || [];
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

export async function executePluginRouterAction({
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
  const plugins = getActiveBundlePlugins();
  return plugins.then(plugins => {
    const plugin = plugins.find(p => p.name === pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }
    const action = plugin.module.pluginRouterActions?.find(p => p.name === actionName);
    if (!action) {
      throw new Error(`Action ${actionName} not found in plugin ${pluginName}`);
    }
    const commonContext = {
      ...pluginContexts.app.init('no-render'),
      ...pluginContexts.store.init(plugin),
      ...pluginContexts.network.init(),
      util: {
        openInBrowser: (url: string) => window.main.openInBrowser(url),
        models: {
          request: {
            getById: models.request.getById,
            getAncestors: async (request: any) => {
              const ancestors = await db.withAncestors<Request | RequestGroup | Workspace>(request, [
                models.requestGroup.type,
                models.workspace.type,
              ]);
              return ancestors.filter(doc => doc._id !== request._id);
            },
          },
          workspace: {
            getById: models.workspace.getById,
          },
          oAuth2Token: {
            getByRequestId: models.oAuth2Token.getByParentId,
          },
          cookieJar: {
            getOrCreateForParentId: (parentId: string) => {
              return models.cookieJar.getOrCreateForParentId(parentId);
            },
          },
          response: {
            getLatestForRequestId: models.response.getLatestForRequest,
            getBodyBuffer: models.response.getBodyBuffer,
          },
          settings: {
            getSettings: models.settings.get,
          },
        },
      },
    };
    return action.action({ ...commonContext, ...context }, params);
  });
}

export async function getRequestHooks(): Promise<RequestHook[]> {
  let functions: RequestHook[] = [
    {
      plugin: {
        name: 'default-headers',
        description: 'Set default headers for all requests',
        version: '0.0.0',
        directory: '',
        config: {
          disabled: false,
        },
        module: {},
      },
      hook: context => {
        const headers = context.request.getEnvironmentVariable('DEFAULT_HEADERS');
        if (!headers) {
          return;
        }
        for (const name of Object.keys(headers)) {
          const value = headers[name];
          if (context.request.hasHeader(name)) {
            console.log(`[header] Skip setting default header ${name}. Already set to ${value}`);
            continue;
          }
          if (value === 'null') {
            context.request.removeHeader(name);
            console.log(`[header] Remove default header ${name}`);
          } else {
            context.request.setHeader(name, value);
            console.log(`[header] Set default header ${name}: ${value}`);
          }
        }
      },
    },
  ];

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
