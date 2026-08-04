import fs from 'node:fs';
import path from 'node:path';

import electron from 'electron';
import type { Request, RequestGroup, Workspace } from 'insomnia-data';
import { database as db, models, services } from 'insomnia-data';
import type { PluginConfigMap } from 'insomnia-data/common';

import { parsePluginPermissions } from '~/common/plugins/permissions';
import { type SandboxSettings, shouldSandboxPlugin } from '~/common/plugins/sandbox-mode';
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
} from '~/common/plugins/types';
import { fetchFromTemplateWorkerDatabase } from '~/common/templating/liquid-extension-worker';
import type { PluginTemplateTag, RenderPurpose } from '~/common/templating/types';
import type { ActionDescriptor, PluginExportManifest } from '~/templating/sandbox/marshal';

import { getAppBundlePlugins, isDevelopment } from '../common/constants';
import * as pluginApp from '../plugins/context/app';
import * as pluginNetwork from '../plugins/context/network';
import * as pluginStore from '../plugins/context/store';
import themes from './themes';

let plugins: Plugin[] | null | undefined = null;

export function _testOnlySetPlugins(p: Plugin[] | null) {
  plugins = p;
}

// The native `require` is in scope inside the bundled CommonJS that runs in the Electron plugin
// window and main process; the inso CLI exposes it via `global.require`, so we use it when present
// to ensure plugin modules load in all three runtimes.
function getNodeRequire(): NodeRequire {
  const globalRequire = (global as typeof global & { require?: unknown }).require;
  if (typeof globalRequire === 'function') {
    return globalRequire as NodeRequire;
  }
  if (typeof require === 'function') {
    return require;
  }
  throw new Error('No require function available to load plugin modules');
}

export async function init() {
  await reloadPlugins();
}

// Build a user plugin's `module` from the sandbox-discovered export manifest (L1). Only descriptors
// cross from the sandbox — no live functions. Execution is routed separately: a template tag's
// `run()` goes through the sandbox bridge (`plugin.executeUserPluginTag`), so the stub `run` here is
// never called while the sandbox is on. Hook/action invocation isn't sandbox-routed yet, so those
// function members throw a clear error until that lands (PR 10/11); the plugin's tags/hooks/actions
// still *enumerate* in the UI from these descriptors.
// Run sandbox export discovery for a user plugin. getPlugins/traversePluginPath runs in BOTH the
// main process (via getTemplateTags in templating-worker-database) and the plugin window, so the
// discovery has to reach the sandbox from either. In main we call the sandbox directly — the
// `insomnia-templating-worker-database://` protocol is a renderer<->main channel and main's own
// `fetch` can't resolve it. In a renderer (the plugin window) we go over that protocol.
async function discoverUserPluginExports(
  directory: string,
  name: string,
  permissions: Plugin['permissions'],
): Promise<PluginExportManifest> {
  const body = { directory, name, permissions };
  if (__IS_RENDERER__) {
    return (await fetchFromTemplateWorkerDatabase('plugin.discoverUserPluginExports', body)) as PluginExportManifest;
  }
  const { discoverUserPluginExportsForLoader } = await import('~/main/templating-worker-database');
  return discoverUserPluginExportsForLoader(body);
}

function buildUserPluginModuleFromManifest(pluginName: string, manifest: PluginExportManifest): Plugin['module'] {
  const notRouted = (surface: string) => () => {
    throw new Error(
      `Plugin "${pluginName}": sandboxed ${surface} are not supported yet. Disable "Run template tags in sandbox" to use them.`,
    );
  };
  const toAction = (surface: string) => (a: ActionDescriptor) => ({
    label: a.label ?? '',
    icon: a.icon,
    action: notRouted(surface),
  });
  // The count comes from untrusted sandbox output; clamp to a finite, non-negative, bounded integer
  // before allocating so a hostile manifest can't drive a huge Array.from allocation (the sandbox
  // clamps too — this is defense in depth).
  const hookStubs = (count: number, surface: string) =>
    Array.from({ length: Number.isFinite(count) && count > 0 ? Math.min(Math.floor(count), 1000) : 0 }, () =>
      notRouted(surface),
    );
  return {
    templateTags: manifest.templateTags.map(t => ({ ...t, run: notRouted('template-tag run()') }) as PluginTemplateTag),
    requestHooks: hookStubs(manifest.requestHooks, 'request hooks'),
    responseHooks: hookStubs(manifest.responseHooks, 'response hooks'),
    requestActions: manifest.requestActions.map(toAction('request actions')),
    requestGroupActions: manifest.requestGroupActions.map(toAction('request group actions')),
    workspaceActions: manifest.workspaceActions.map(toAction('workspace actions')),
    documentActions: manifest.documentActions.map(toAction('document actions')),
    themes: manifest.themes,
  } as Plugin['module'];
}

// Finds package.json `name`s claimed by more than one folder under `allPaths`, read-only and before
// any folder is trusted, so the result doesn't depend on filesystem read order.
async function findDuplicatePluginNames(allPaths: string[]): Promise<Set<string>> {
  const nameCounts: Record<string, number> = {};

  const walk = (paths: string[]) => {
    for (const p of paths) {
      if (!fs.existsSync(p)) {
        continue;
      }
      for (const filename of fs.readdirSync(p)) {
        const modulePath = path.resolve(p, filename);
        if (!fs.statSync(modulePath).isDirectory()) {
          continue;
        }
        if (filename.startsWith('@')) {
          walk([modulePath]);
        }
        if (!fs.readdirSync(modulePath).includes('package.json')) {
          continue;
        }
        if (!path.resolve(modulePath).startsWith(p)) {
          continue;
        }
        try {
          // package.json is plain data — reading it runs no plugin code.
          const pluginJson = getNodeRequire()(path.resolve(modulePath, 'package.json'));
          if ('insomnia' in pluginJson && typeof pluginJson.name === 'string') {
            nameCounts[pluginJson.name] = (nameCounts[pluginJson.name] ?? 0) + 1;
          }
        } catch {
          // Any read/parse error here will be hit (and reported) again by the real pass below.
        }
      }
    }
  };
  walk(allPaths);

  return new Set(Object.keys(nameCounts).filter(name => nameCounts[name] > 1));
}

async function traversePluginPath(
  pluginMap: Record<string, Plugin>,
  allPaths: string[],
  allConfigs: PluginConfigMap,
  settings: SandboxSettings,
  duplicatePluginNames: Set<string>,
) {
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
          await traversePluginPath(pluginMap, [modulePath], allConfigs, settings, duplicatePluginNames);
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

        const nodeRequire = getNodeRequire();

        // Now delete the require cache for this module, ensuring we're deleting only the relevant entries
        for (const cachePath of Object.keys(nodeRequire.cache)) {
          // Check if the cache path starts with the safe module path
          if (cachePath.startsWith(safeModulePath)) {
            delete nodeRequire.cache[cachePath];
          }
        }

        // package.json is plain data — requiring it runs no plugin code (unlike the module below).
        const pluginJson = nodeRequire(packageJSONPath);

        // Not an Insomnia plugin because it doesn't have the package.json['insomnia']
        if (!('insomnia' in pluginJson)) {
          continue;
        }

        // pluginConfig is keyed by declared name, not by folder — never load a name claimed by more
        // than one folder, so a colliding folder can't inherit another folder's `elevated` grant.
        if (duplicatePluginNames.has(pluginJson.name)) {
          console.warn('[plugin] Ignoring %s at %s: multiple plugin folders declare this name.', pluginJson.name, modulePath);
          continue;
        }

        const parsedPermissions = parsePluginPermissions(pluginJson.insomnia);
        if (parsedPermissions.warnings.length > 0) {
          // Constant format string; interpolated values passed as args so a plugin name can't forge log output.
          console.warn('[plugin] %s has invalid insomnia.permissions: %o', pluginJson.name, parsedPermissions.warnings);
        }

        const config = pluginJson.name in allConfigs ? allConfigs[pluginJson.name] : { disabled: false };

        // L1/T1: a sandboxed user plugin's exports are discovered by evaluating its source *inside* the
        // sandbox (main process) instead of nodeRequire-ing it here — so installing/enabling it never
        // runs its top-level code with host (Node) privileges. An elevated plugin (or sandbox-off) is
        // nodeRequire-d so its hooks/actions/tags are live in-process functions. Decision is per-plugin
        // because `elevated` is per-plugin.
        let module: Plugin['module'];
        if (shouldSandboxPlugin(settings, { directory: modulePath, config })) {
          const manifest = await discoverUserPluginExports(modulePath, pluginJson.name, parsedPermissions.permissions);
          module = buildUserPluginModuleFromManifest(pluginJson.name, manifest);
        } else {
          module = nodeRequire(modulePath);
        }

        pluginMap[pluginJson.name] = {
          name: pluginJson.name,
          description: pluginJson.description || pluginJson.insomnia.description || '',
          version: pluginJson.version || 'unknown',
          directory: modulePath || '',
          config,
          permissions: parsedPermissions.permissions,
          permissionWarnings: parsedPermissions.warnings,
          permissionsDeclared: parsedPermissions.declared,
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
      process.env['INSOMNIA_DATA_PATH'] || (__IS_RENDERER__ ? window : electron).app.getPath('userData'),
      'plugins',
    );

    // Also look in node_modules folder in each directory
    const basePaths = [pluginPath, ...extraPaths];
    const extendedPaths = basePaths.map(p => path.resolve(p, 'node_modules'));
    const allPaths = [...basePaths, ...extendedPaths];

    // Store plugins in a map so that plugins with the same name only get added once
    const pluginMap: Record<string, Plugin> = {};
    const duplicatePluginNames = await findDuplicatePluginNames(allPaths);
    await traversePluginPath(pluginMap, allPaths, allConfigs, settings, duplicatePluginNames);
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
      const module = getNodeRequire()(bundlePluginPath);
      bundlePluginMap[pluginName] = {
        name: pluginName,
        description: `Insomnia bundled plugin for ${pluginName}`,
        version: 'unknown',
        directory: '',
        config: { disabled: false },
        // Bundle plugins are first-party; they declare no manifest and run on the baseline grant.
        permissions: { modules: [], capabilities: [] },
        permissionWarnings: [],
        permissionsDeclared: false,
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
        __IS_RENDERER__ ? window.main.openInBrowser(url) : electron.shell.openExternal(url),
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
