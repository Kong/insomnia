import electron from 'electron';
import fs from 'fs';
import path from 'path';

import { ParsedApiSpec } from '../common/api-specs';
import type { PluginConfig, PluginConfigMap } from '../common/settings';
import * as models from '../models';
import { GrpcRequest } from '../models/grpc-request';
import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import { WebSocketRequest } from '../models/websocket-request';
import type { Workspace } from '../models/workspace';
import type { PluginTemplateTag } from '../templating/extensions/index';
import { showError } from '../ui/components/modals/index';
import type { PluginTheme } from './misc';
import themes from './themes';

export interface Module {
  templateTags?: PluginTemplateTag[];
  requestHooks?: ((requestContext: any) => void)[];
  responseHooks?: ((responseContext: any) => void)[];
  themes?: PluginTheme[];
  requestGroupActions?: OmitInternal<RequestGroupAction>[];
  requestActions?: OmitInternal<RequestAction>[];
  workspaceActions?: OmitInternal<WorkspaceAction>[];
  documentActions?: OmitInternal<DocumentAction>[];
}

export interface Plugin {
  name: string;
  description: string;
  version: string;
  directory: string;
  config: PluginConfig;
  module: Module;
}
interface InternalProperties {
  plugin: Plugin;
}

type OmitInternal<T> = Omit<T, keyof InternalProperties>;
export interface TemplateTag extends InternalProperties {
  templateTag: PluginTemplateTag;
}

export interface RequestGroupAction extends InternalProperties {
  action: (
    context: Record<string, any>,
    models: {
      requestGroup: RequestGroup;
      requests: (Request | GrpcRequest | WebSocketRequest)[];
    },
  ) => void | Promise<void>;
  label: string;
  icon?: string;
}

export interface RequestAction extends InternalProperties {
  action: (
    context: Record<string, any>,
    models: {
      requestGroup?: RequestGroup;
      request: Request | GrpcRequest | WebSocketRequest;
    },
  ) => void | Promise<void>;
  label: string;
  icon?: string;
}

export interface WorkspaceAction extends InternalProperties {
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
}

export interface DocumentAction extends InternalProperties {
  action: (context: Record<string, any>, documents: ParsedApiSpec) => void | Promise<void>;
  label: string;
  hideAfterClick?: boolean;
}

type RequestHookCallback = (context: any) => void;

export interface RequestHook extends InternalProperties {
  hook: RequestHookCallback;
}

type ResponseHookCallback = (context: any) => void;
export interface ResponseHook extends InternalProperties {
  hook: ResponseHookCallback;
}

export interface Theme extends InternalProperties {
  theme: PluginTheme;
}

export type ColorScheme = 'default' | 'light' | 'dark';

let plugins: Plugin[] | null | undefined = null;

export async function init() {
  await reloadPlugins();
}

async function _traversePluginPath(
  pluginMap: Record<string, Plugin>,
  allPaths: string[],
  allConfigs: PluginConfigMap,
) {
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
        if (!pluginJson.hasOwnProperty('insomnia')) {
          continue;
        }

        // Delete require cache entry and re-require
        const module = global.require(modulePath);

        pluginMap[pluginJson.name] = {
          name: pluginJson.name,
          description: pluginJson.description || pluginJson.insomnia.description || '',
          version: pluginJson.version || 'unknown',
          directory: modulePath || '',
          config: allConfigs.hasOwnProperty(pluginJson.name)
            ? allConfigs[pluginJson.name]
            : { disabled: false },
          module: module,
        };
        console.log(`[plugin] Loaded ${modulePath}`);
      } catch (err) {
        showError({
          title: 'Plugin Error',
          message: 'Failed to load plugin ' + filename,
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
        } else {
          return p;
        }
      });
    // Make sure the default directories exist
    const pluginPath = path.join(process.env['INSOMNIA_DATA_PATH'] || (process.type === 'renderer' ? window : electron).app.getPath('userData'), 'plugins');
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

export async function reloadPlugins() {
  await getPlugins(true);
}

async function getActivePlugins(): Promise<Plugin[]> {
  return (await getPlugins()).filter(p => !p.config.disabled);
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

export async function getRequestHooks(): Promise<RequestHook[]> {
  let functions: RequestHook[] = [{
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
    } }];

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
