import type { BinaryToTextEncoding } from 'node:crypto';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { app, BrowserWindow, clipboard, dialog, shell } from 'electron';
import iconv from 'iconv-lite';
import type { AllTypes, CloudProviderCredential, Request as DBRequest, RequestGroup, Workspace } from 'insomnia-data';
import { services } from 'insomnia-data';
import { v4 as uuidv4 } from 'uuid';

import { jarFromCookies } from '~/common/cookies';
import { type Plugin, type TemplateTag } from '~/common/plugins/types';
import type {
  AppPromptOptions,
  PluginTemplateTag,
  PluginTemplateTagContext,
  PluginToMainAPIPaths,
} from '~/common/templating/types';
import { getPluginCommonContext, getPlugins, getTemplateTags } from '~/plugins';
import { HOOK_REQUEST_FIELDS, type PluginExportManifest, stripDangerousKeysReviver } from '~/templating/sandbox/marshal';
import type { SandboxModuleDenialError } from '~/templating/sandbox/plugin-tag-sandbox';

import { getAppBundlePlugins, RESPONSE_CODE_REASONS } from '../common/constants';
import { isDevelopment } from '../common/constants';
import { database as db } from '../common/database';
import { fetchRequestData, sendCurlAndWriteTimeline, tryToInterpolateRequest } from '../network/network';
import { curlRequest } from './network/libcurl-promise';
import { requestPromptFromRenderer } from './prompt-bridge';
import { secureReadFile } from './secure-read-file';
import { isValidTemplatingDbAuthToken, TEMPLATING_DB_AUTH_HEADER } from './templating-worker-database-auth';

const bundlePluginModuleMap: Record<string, Plugin['module']> = {};

const templatingDbCorsHeaders = (request: Request): Record<string, string> => ({
  'Access-Control-Allow-Origin': request.headers.get('Origin') ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': `${TEMPLATING_DB_AUTH_HEADER}, content-type`,
  'Vary': 'Origin',
});

export const resolveDbByKey = async (request: Request) => {
  const cors = templatingDbCorsHeaders(request);
  // A CORS preflight never carries the auth header, so answer it before the token check.
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  // Reject before parsing the body, so an unauthenticated call never reaches a handler.
  if (!isValidTemplatingDbAuthToken(request.headers.get(TEMPLATING_DB_AUTH_HEADER))) {
    return new Response(JSON.stringify({ error: 'Unauthorized: missing or invalid templating database auth token' }), {
      status: 401,
      headers: cors,
    });
  }
  const url = new URL(request.url);
  let body;
  try {
    // We expect this to throw if a db call returns undefined
    body = JSON.parse(await request.text(), stripDangerousKeysReviver);
  } catch { }
  // url get normalized to lowercase, so we need to normalize the keys to lower case as well
  const withLowercasedKeys = Object.fromEntries(
    Object.entries(pluginToMainAPI).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const urlHostLowerCase = url.host.toLowerCase();
  // Own-property + function check so a key like "constructor" can't resolve to an inherited member.
  const handler = Object.prototype.hasOwnProperty.call(withLowercasedKeys, urlHostLowerCase)
    ? withLowercasedKeys[urlHostLowerCase]
    : undefined;
  try {
    if (typeof handler !== 'function') {
      throw new TypeError(`No host bridge handler registered for "${urlHostLowerCase}"`);
    }
    const result = await handler(body);
    return new Response(JSON.stringify(result), { headers: cors });
  } catch (err) {
    console.error(`Error resolving db by key ${urlHostLowerCase}:`, err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
};

// Resolves a plugin's on-disk directory and manifest-declared permissions from the trusted plugin
// registry by name, so the two protocol-dispatch handlers below never trust a caller-supplied
// directory path or permissions object.
const resolveTrustedPlugin = async (
  pluginName: string,
): Promise<{ directory: string; permissions: { modules: string[]; capabilities: string[] } }> => {
  const plugins = await getPlugins();
  const plugin = plugins.find(p => p.name === pluginName);
  if (!plugin) {
    throw new Error(`Unknown plugin: ${pluginName}`);
  }
  return { directory: plugin.directory, permissions: plugin.permissions };
};

// The response isn't persisted yet at hook time (no _id to reload by), so instead reject if the
// claimed bodyPath already belongs to a different, already-persisted response's parentId.
const assertResponseBodyPathOwnership = async (response: Record<string, any>): Promise<void> => {
  const bodyPath = response?.bodyPath;
  if (!bodyPath) {
    return;
  }
  // Resolve before the ownership lookup so it agrees with the resolved path the write itself uses,
  // otherwise a textually different bodyPath resolving to the same file misses this exact-string lookup.
  const existing = await services.response.getByBodyPath(path.resolve(bodyPath));
  if (existing && existing.parentId !== response.parentId) {
    throw new Error('response.bodyPath belongs to a different response than the one being processed');
  }
};

// Read-side counterpart of assertResponseBodyPathOwnership: rejects a bodyPath that isn't the stored bodyPath of an already-persisted response.
const assertResponseBodyPathReadOwnership = async (bodyPath: string | undefined): Promise<void> => {
  if (!bodyPath) {
    return;
  }
  const existing = await services.response.getByBodyPath(path.resolve(bodyPath));
  if (!existing) {
    throw new Error('response.bodyPath does not belong to any known response');
  }
};

const getBundlePluginModule = (pluginName: string): Plugin['module'] => {
  if (pluginName in Object.keys(bundlePluginModuleMap)) {
    return bundlePluginModuleMap[pluginName];
  }
  try {
    const module = require(pluginName) as Plugin['module'];
    bundlePluginModuleMap[pluginName] = module;
    return module;
  } catch (err) {
    if (isDevelopment()) {
      console.warn(
        `[plugin] Failed to load bundled plugin ${pluginName}. You can ignore this warning if you not developing external vault feature.`,
      );
    } else {
      console.error(`Failed to load bundled plugin ${pluginName}`, err);
    }
  }
  return {};
};

// Run a resolved plugin template tag with a freshly-built common context. Shared by the bundle
// and user-plugin execute handlers so both build context (incl. renderPurpose) identically.
const runPluginTag = (
  run: (context: any, ...args: any[]) => any,
  body: {
    args: any[];
    pluginName: string;
    context: Pick<PluginTemplateTagContext, 'meta' | 'renderPurpose' | 'context'>;
  },
) => {
  const { pluginName, args, context: originContext } = body;
  const { meta, renderPurpose, context } = originContext;
  const commonContext = getPluginCommonContext({ plugin: { name: pluginName }, renderPurpose });
  return run({ meta, renderPurpose, context, ...commonContext }, ...args);
};

// Read a plugin's entry-point source as text so it can be evaluated inside the QuickJS sandbox.
// User plugins resolve via their on-disk directory + package.json "main"; we avoid require.resolve
// because the bundled main process shims it via createRequire(import.meta.url) where import.meta.url
// is undefined, which throws "filename ... Received undefined". Bundle plugins (no directory) fall
// back to require.resolve by name.
export const getPluginEntrySource = ({ directory, name }: { directory: string; name: string }): string => {
  try {
    let entryPath: string;
    if (directory) {
      const base = path.resolve(directory);
      const pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
      // Contain the entry point inside the plugin's own directory — a hostile "main" must not be
      // able to read (and then execute) a file outside the plugin folder.
      entryPath = path.resolve(base, pkg.main || 'index.js');
      const relative = path.relative(base, entryPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`plugin entry point escapes plugin directory: ${pkg.main}`);
      }
      // Re-check after resolving symlinks, since a symlinked entry can point outside `base`.
      const realRelative = path.relative(fs.realpathSync(base), fs.realpathSync(entryPath));
      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
        throw new Error(`plugin entry point escapes plugin directory: ${pkg.main}`);
      }
    } else {
      // Bundle plugins resolve by bare package name only — never a path.
      if (name.includes('..') || path.isAbsolute(name)) {
        throw new Error(`invalid bundled plugin name: ${name}`);
      }
      entryPath = require.resolve(name);
    }
    return fs.readFileSync(entryPath, 'utf8');
  } catch (err) {
    throw new Error(
      `Failed to load sandbox source for plugin '${name}': ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

// True when `target` is `base` itself or lives inside it (after both are realpath-resolved).
const isContainedIn = (base: string, target: string): boolean => {
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

// Bounds so a pathological plugin directory can't exhaust memory when read into the module map.
const MAX_PLUGIN_MODULE_FILES = 500;
const MAX_PLUGIN_MODULE_BYTES = 10 * 1024 * 1024;

// Read a plugin's own source files into a module map for the sandbox's relative-require loader (M4).
// Walks ONLY within the plugin's directory — `node_modules` and dot-dirs are skipped and symlinked
// files whose real path escapes the directory are dropped — so the plugin's own dependencies are
// never loaded (bare `require('x')` always routes to the vetted registry, never the plugin's copy).
// Bundle (first-party) plugins have no directory and stay single-file.
export const readPluginModuleMap = ({
  directory,
  name,
}: {
  directory: string;
  name: string;
}): { moduleFiles: Record<string, string>; entryModuleKey: string } => {
  if (!directory) {
    return { moduleFiles: { 'index.js': getPluginEntrySource({ directory: '', name }) }, entryModuleKey: 'index.js' };
  }
  try {
    const base = fs.realpathSync(path.resolve(directory));
    const pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
    const entryAbs = path.resolve(base, pkg.main || 'index.js');
    // Check the plain resolved path first (catches traversal even if the target doesn't exist),
    // then the realpath (catches a symlinked entry pointing outside the dir).
    if (!isContainedIn(base, entryAbs) || !isContainedIn(base, fs.realpathSync(entryAbs))) {
      throw new Error(`plugin entry point escapes plugin directory: ${pkg.main}`);
    }
    const toKey = (abs: string) => path.relative(base, abs).split(path.sep).join('/');
    const moduleFiles: Record<string, string> = {};
    let totalBytes = 0;
    let fileCount = 0;
    // Count UTF-8 bytes (not source.length, which is UTF-16 code units and undercounts multi-byte
    // characters) so the limit reflects the real payload shipped into the sandbox envelope.
    const addModule = (key: string, source: string): void => {
      totalBytes += Buffer.byteLength(source, 'utf8');
      if (totalBytes > MAX_PLUGIN_MODULE_BYTES) {
        throw new Error('plugin source exceeds the sandbox size limit');
      }
      moduleFiles[key] = source;
      fileCount++;
    };
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(abs);
          continue;
        }
        // package.json is plugin metadata, not a requireable module — keep it out of the map.
        if (!entry.isFile() || entry.name === 'package.json' || !/\.(js|json)$/.test(entry.name)) {
          continue;
        }
        if (!isContainedIn(base, fs.realpathSync(abs))) {
          continue; // symlink whose target escapes the plugin dir
        }
        if (fileCount >= MAX_PLUGIN_MODULE_FILES) {
          throw new Error(`plugin has too many source files (> ${MAX_PLUGIN_MODULE_FILES})`);
        }
        addModule(toKey(abs), fs.readFileSync(abs, 'utf8'));
      }
    };
    walk(base);
    const entryModuleKey = toKey(entryAbs);
    if (!Object.prototype.hasOwnProperty.call(moduleFiles, entryModuleKey)) {
      // The entry may sit outside the walk (e.g. a custom package.json "main"); still count it
      // against the size limit rather than adding it unbounded.
      addModule(entryModuleKey, fs.readFileSync(entryAbs, 'utf8'));
    }
    return { moduleFiles, entryModuleKey };
  } catch (err) {
    throw new Error(
      `Failed to load sandbox source for plugin '${name}': ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

// (plugin name, module) pairs we've already toasted for this session — so a repeat denial for the
// SAME missing module doesn't re-toast, but a plugin missing two different grants still gets a
// distinct hint for each one it actually hits (P1).
const warnedManifestlessPlugins = new Set<string>();
const manifestWarningKey = (pluginName: string, moduleName: string) => JSON.stringify([pluginName, moduleName]);

export const _testOnlyResetMigrationWarnings = () => warnedManifestlessPlugins.clear();

// A manifest-less plugin denied a non-baseline module gets a one-time migration toast naming the
// grant to add. Ungranted capabilities are absent branches (C2), not host-visible denials, so
// there's no toast for those.
export const maybeWarnMissingManifest = (
  plugin: { name: string; permissionsDeclared: boolean },
  err: unknown,
): void => {
  if (plugin.permissionsDeclared) {
    return;
  }
  // Type-only import — no runtime dependency on the WASM-backed sandbox module.
  const isModuleNotPermitted =
    err instanceof Error &&
    (err as Partial<SandboxModuleDenialError>).code === 'SANDBOX_MODULE_NOT_PERMITTED' &&
    typeof (err as Partial<SandboxModuleDenialError>).moduleName === 'string';
  if (!isModuleNotPermitted) {
    return;
  }
  const missingModule = (err as SandboxModuleDenialError).moduleName;
  const key = manifestWarningKey(plugin.name, missingModule);
  if (warnedManifestlessPlugins.has(key)) {
    return;
  }
  warnedManifestlessPlugins.add(key);
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('show-toast', {
      content: {
        title: 'Plugin needs a permissions manifest',
        description: `"${plugin.name}" tried to require "${missingModule}" but has no valid permissions manifest. Add insomnia.permissions.modules: ["${missingModule}"] to its package.json to run it under the template-tag sandbox.`,
        status: 'warning',
      },
    });
  }
};

// Execute a plugin template tag inside the QuickJS-WASM sandbox instead of directly in the main
// process. The host bridge reuses the existing pluginToMainAPI handlers verbatim, plus a util.render
// handler that recurses through main templating. Gated behind the templateTagSandboxEnabled setting.
// The plugin's own source, either a single entry string (single-file plugins/tests) or a full
// module map read from disk (M4 multi-file plugins).
type PluginModuleSource = string | { moduleFiles: Record<string, string>; entryModuleKey: string };

// node:crypto is synchronous and available in main, so back the sandbox's require('crypto') shim with
// it via sync host functions rather than the async bridge. Stateless, so shared across sandbox runs.
const SANDBOX_HOST_CRYPTO = {
  hash: (algo: string, data: string, inputEncoding: string, outputEncoding: string) =>
    crypto
      .createHash(algo)
      .update(data, inputEncoding as crypto.Encoding)
      .digest(outputEncoding as BinaryToTextEncoding),
  hmac: (algo: string, key: string, data: string, outputEncoding: string) =>
    crypto
      .createHmac(algo, key)
      .update(data, 'utf8')
      .digest(outputEncoding as BinaryToTextEncoding),
  randomBytes: (size: number) => crypto.randomBytes(size).toString('base64'),
  randomUUID: () => crypto.randomUUID(),
};

// Build the capability-gated host bridge shared by tag execution and load-time discovery. The handler
// map is filtered by capability first, so an ungranted path rejects at the bridge naming the missing
// capability rather than silently running.
const buildSandboxBridge = async (capabilities: string[]) => {
  const { createMapBridge, filterByCapabilities } = await import('../templating/sandbox/host-bridge');
  return createMapBridge(
    filterByCapabilities(
      {
        ...(pluginToMainAPI as Record<string, (b: any) => Promise<any>>),
        // allowTags: false so a sandboxed plugin can't invoke another tag's real, unsandboxed run()
        // (including its own) by handing util.render a string containing "{% tagName %}".
        'util.render': async (b: { str: string; context: Record<string, any> }) => {
          const { render } = await import('../templating');
          return render(b.str, { context: b.context, allowTags: false });
        },
      },
      capabilities,
    ),
  );
};

export const runPluginTagInSandbox = async (
  pluginModule: PluginModuleSource,
  body: {
    args: any[];
    pluginName: string;
    tagName: string;
    context: Pick<PluginTemplateTagContext, 'meta' | 'renderPurpose' | 'context'>;
  },
  // Registry-module names the plugin may require(). Defaults to the baseline floor; callers pass the
  // plugin's manifest-resolved grant (baseline ∪ insomnia.permissions.modules).
  grantedModules?: string[],
  // Capability groups the plugin may reach through the host bridge. Defaults to the baseline floor;
  // callers pass baseline ∪ insomnia.permissions.capabilities (bundle plugins pass ALL_CAPABILITIES).
  grantedCapabilities?: string[],
): Promise<string> => {
  const { runTagInSandbox } = await import('../templating/sandbox/plugin-tag-sandbox');
  const { TEMPLATE_TAG_BASELINE_CAPABILITIES } = await import('../templating/sandbox/host-bridge');
  const { TEMPLATE_TAG_BASELINE_MODULES } = await import('../templating/sandbox/module-registry');
  const { pluginName, tagName, args, context: originContext } = body;
  const { meta, renderPurpose, context } = originContext;
  const capabilities = grantedCapabilities ?? [...TEMPLATE_TAG_BASELINE_CAPABILITIES];
  const { moduleFiles, entryModuleKey } =
    typeof pluginModule === 'string'
      ? { moduleFiles: { 'index.js': pluginModule }, entryModuleKey: 'index.js' }
      : pluginModule;
  const bridge = await buildSandboxBridge(capabilities);
  return runTagInSandbox({
    tagName,
    bridge,
    hostCrypto: SANDBOX_HOST_CRYPTO,
    envelope: {
      args: args || [],
      context: (context as Record<string, any>) || {},
      meta,
      renderPurpose,
      appInfo: { version: app.getVersion(), platform: process.platform, arch: process.arch },
      pluginName,
      renderDepth: 0,
      grantedModules: grantedModules ?? [...TEMPLATE_TAG_BASELINE_MODULES],
      grantedCapabilities: capabilities,
      moduleFiles,
      entryModuleKey,
    },
  });
};

// L1 load-time discovery: evaluate a user plugin's source inside the sandbox and return a manifest of
// its exports, instead of nodeRequire-ing it on the host. The plugin's top-level code runs in the
// sandbox (default-deny require, no host reach), so installing/enabling it can't execute host code.
export const discoverPluginExportsInSandbox = async (
  pluginModule: PluginModuleSource,
  opts: { pluginName: string; grantedModules: string[]; grantedCapabilities: string[] },
): Promise<PluginExportManifest> => {
  const { runTagInSandbox } = await import('../templating/sandbox/plugin-tag-sandbox');
  const { moduleFiles, entryModuleKey } =
    typeof pluginModule === 'string'
      ? { moduleFiles: { 'index.js': pluginModule }, entryModuleKey: 'index.js' }
      : pluginModule;
  const bridge = await buildSandboxBridge(opts.grantedCapabilities);
  const json = await runTagInSandbox({
    tagName: '',
    discover: true,
    bridge,
    hostCrypto: SANDBOX_HOST_CRYPTO,
    envelope: {
      args: [],
      context: {},
      appInfo: { version: app.getVersion(), platform: process.platform, arch: process.arch },
      pluginName: opts.pluginName,
      renderDepth: 0,
      grantedModules: opts.grantedModules,
      grantedCapabilities: opts.grantedCapabilities,
      moduleFiles,
      entryModuleKey,
    },
  });
  return JSON.parse(json, stripDangerousKeysReviver);
};

// Discover a user plugin's exports from its on-disk source, resolving the template-tag surface grant
// from its manifest. Shared by the plugin loader (plugins/index.ts calls this directly when it runs
// in the main process) and the `plugin.discoverUserPluginExports` bridge handler (renderer path).
export const discoverUserPluginExportsForLoader = async (body: {
  directory: string;
  name: string;
  permissions?: { modules?: string[]; capabilities?: string[] };
}): Promise<PluginExportManifest> => {
  const { directory, name, permissions } = body;
  const { resolveTemplateTagModules, resolveTemplateTagCapabilities } = await import(
    '../templating/sandbox/surface-profiles'
  );
  return discoverPluginExportsInSandbox(readPluginModuleMap({ directory, name }), {
    pluginName: name,
    grantedModules: resolveTemplateTagModules(permissions?.modules),
    grantedCapabilities: resolveTemplateTagCapabilities(permissions?.capabilities),
  });
};

const pickHookRequestFields = (req: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const key of HOOK_REQUEST_FIELDS) {
    if (req[key] !== undefined) {
      out[key] = req[key];
    }
  }
  return out;
};

// H1: run a user plugin's request hook (at hookIndex) inside the sandbox, capability-gated. The hook
// mutates the request in the sandbox; we marshal the mutated field subset back for the caller to
// merge onto the request it is building. Reuses the same bridge/grants/crypto as tag execution.
export const runRequestHookInSandbox = async (
  plugin: { directory: string; name: string; permissions?: { modules?: string[]; capabilities?: string[] } },
  hookIndex: number,
  renderedRequest: Record<string, any>,
  renderContext: Record<string, any>,
): Promise<Record<string, any>> => {
  const { runTagInSandbox } = await import('../templating/sandbox/plugin-tag-sandbox');
  const { resolveTemplateTagModules, resolveTemplateTagCapabilities } = await import(
    '../templating/sandbox/surface-profiles'
  );
  const grantedCapabilities = resolveTemplateTagCapabilities(plugin.permissions?.capabilities);
  const bridge = await buildSandboxBridge(grantedCapabilities);
  const { moduleFiles, entryModuleKey } = readPluginModuleMap({ directory: plugin.directory, name: plugin.name });
  const hookRequest = pickHookRequestFields(renderedRequest);
  const json = await runTagInSandbox({
    tagName: '',
    bridge,
    hostCrypto: SANDBOX_HOST_CRYPTO,
    envelope: {
      args: [],
      context: (renderContext as Record<string, any>) || {},
      meta: {},
      renderPurpose: 'send',
      appInfo: { version: app.getVersion(), platform: process.platform, arch: process.arch },
      pluginName: plugin.name,
      renderDepth: 0,
      grantedModules: resolveTemplateTagModules(plugin.permissions?.modules),
      grantedCapabilities,
      moduleFiles,
      entryModuleKey,
      hookKind: 'request',
      hookIndex,
      hookRequest,
    },
  });
  const result = JSON.parse(json, stripDangerousKeysReviver) as { request?: Record<string, any> };
  return result.request ?? hookRequest;
};

// The serializable ResponsePatch fields a response hook reads (the body itself lives on disk at
// bodyPath and is read/written via the response.getBodyBuffer / response.setBody bridge paths).
const HOOK_RESPONSE_FIELDS = [
  'parentId',
  'statusCode',
  'statusMessage',
  'bytesRead',
  'bytesContent',
  'elapsedTime',
  'headers',
  'bodyPath',
  'bodyCompression',
  'contentType',
  'httpVersion',
  'url',
  'error',
  'message',
] as const;

const pickHookResponseFields = (resp: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const key of HOOK_RESPONSE_FIELDS) {
    if (resp[key] !== undefined) {
      out[key] = resp[key];
    }
  }
  return out;
};

// H1: run a user plugin's response hook (at hookIndex) inside the sandbox, capability-gated. The hook
// reads the response (and a read-only request) and may rewrite the body via the response.setBody
// bridge; we marshal the mutated response fields back for the caller to merge.
export const runResponseHookInSandbox = async (
  plugin: { directory: string; name: string; permissions?: { modules?: string[]; capabilities?: string[] } },
  hookIndex: number,
  response: Record<string, any>,
  renderedRequest: Record<string, any>,
  renderContext: Record<string, any>,
): Promise<Record<string, any>> => {
  const { runTagInSandbox } = await import('../templating/sandbox/plugin-tag-sandbox');
  const { resolveTemplateTagModules, resolveTemplateTagCapabilities } = await import(
    '../templating/sandbox/surface-profiles'
  );
  const grantedCapabilities = resolveTemplateTagCapabilities(plugin.permissions?.capabilities);
  const bridge = await buildSandboxBridge(grantedCapabilities);
  const { moduleFiles, entryModuleKey } = readPluginModuleMap({ directory: plugin.directory, name: plugin.name });
  const hookResponse = pickHookResponseFields(response);
  const json = await runTagInSandbox({
    tagName: '',
    bridge,
    hostCrypto: SANDBOX_HOST_CRYPTO,
    envelope: {
      args: [],
      context: (renderContext as Record<string, any>) || {},
      meta: {},
      renderPurpose: 'send',
      appInfo: { version: app.getVersion(), platform: process.platform, arch: process.arch },
      pluginName: plugin.name,
      renderDepth: 0,
      grantedModules: resolveTemplateTagModules(plugin.permissions?.modules),
      grantedCapabilities,
      moduleFiles,
      entryModuleKey,
      hookKind: 'response',
      hookIndex,
      hookRequest: pickHookRequestFields(renderedRequest),
      hookResponse,
    },
  });
  // Sanitize untrusted sandbox output at the point it re-enters host memory (#10290).
  const result = JSON.parse(json, stripDangerousKeysReviver) as { response?: Record<string, any> };
  return result.response ?? hookResponse;
};

// These are exposed to the templating worker and can be used by plugins from context.util.
// Exported so tests can enumerate every registered path.
export const pluginToMainAPI: Record<PluginToMainAPIPaths, (...args: any[]) => Promise<any>> = {
  'readFile': async (body: { path: string }) => {
    return secureReadFile(body.path);
  },
  'nodeOS': async () => {
    return {
      arch: os.arch(),
      platform: os.platform(),
      release: os.release(),
      cpus: os.cpus(),
      hostname: os.hostname(),
      freemem: os.freemem(),
      userInfo: os.userInfo(),
    };
  },
  'decode': async (body: { buffer: Buffer; encoding: 'utf8' }) => {
    return iconv.decode(body.buffer, body.encoding || 'utf8');
  },
  'encode': async (body: { input: string; encoding: BinaryToTextEncoding }) => {
    return crypto.createHash('md5').update(body.input).digest(body.encoding);
  },
  'request.getById': async (body: { id: string }) => {
    return await services.request.getById(body.id);
  },
  'request.getAncestors': async (body: { request: DBRequest | RequestGroup | Workspace; types: AllTypes[] }) => {
    return await db.withAncestors<DBRequest | RequestGroup | Workspace>(body.request, body.types);
  },
  'workspace.getById': async (body: { id: string }) => {
    return await services.workspace.getById(body.id);
  },
  'oAuth2Token.getByRequestId': async (body: { parentId: string }) => {
    return await services.oAuth2Token.getByParentId(body.parentId);
  },
  'cookieJar.getOrCreateForParentId': async (body: { parentId: string }) => {
    return await services.cookieJar.getOrCreateForParentId(body.parentId);
  },
  'cookieJar.getCookiesForUrl': async (body: { parentId: string; url: string }) => {
    const cookies = await services.cookieJar.getOrCreateForParentId(body.parentId);
    const jar = jarFromCookies(cookies.cookies);
    return jar.getCookiesSync(body.url).map(c => c.toJSON());
  },
  'response.getLatestForRequestId': async (body: { requestId: string; environmentId: string }) => {
    return await services.response.getLatestForRequestId(body.requestId, body.environmentId);
  },
  'response.getBodyBuffer': async (body: {
    response?: { bodyPath?: string; bodyCompression?: any };
    readFailureValue?: string;
  }) => {
    await assertResponseBodyPathReadOwnership(body.response?.bodyPath);
    return await services.helpers.getResponseBodyBuffer(body.response, body.readFailureValue);
  },
  // H1: a sandboxed response hook's context.response.setBody(). The body arrives base64-encoded (so
  // the bytes survive the JSON bridge). Contain the write to the responses directory as defense in
  // depth — bodyPath is host-set, but this handler must never write outside it even if that changes.
  'response.setBody': async (body: { bodyPath?: string; bodyBase64?: string; parentId?: string }) => {
    if (!body.bodyPath) {
      throw new Error('Could not set body without existing body path');
    }
    // A write primitive must never silently truncate: reject a missing/non-string bodyBase64 rather
    // than defaulting to '' (which would zero the body). An empty string is a valid empty body.
    if (typeof body.bodyBase64 !== 'string') {
      throw new TypeError('response.setBody requires a base64-encoded body');
    }
    // This handler is directly dispatchable, not only reachable via plugin.runUserResponseHook, so the
    // ownership check must live at this actual write choke point (#10286 bypass).
    await assertResponseBodyPathOwnership({ bodyPath: body.bodyPath, parentId: body.parentId });
    const responsesDir = path.resolve(process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData'), 'responses');
    const target = path.resolve(body.bodyPath);
    const relative = path.relative(responsesDir, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('response.setBody path escapes the responses directory');
    }
    fs.writeFileSync(target, Buffer.from(body.bodyBase64, 'base64'));
    return null;
  },
  'pluginData.hasItem': async (body: { pluginName: string; key: string }) => {
    const doc = await services.pluginData.getByKey(body.pluginName, body.key);
    return doc !== null;
  },
  'pluginData.setItem': async (body: { pluginName: string; key: string; value: string }) => {
    return services.pluginData.upsertByKey(body.pluginName, body.key, String(body.value));
  },
  'pluginData.getItem': async (body: { pluginName: string; key: string }) => {
    const doc = await services.pluginData.getByKey(body.pluginName, body.key);
    return doc ? doc.value : null;
  },
  'pluginData.removeItem': async (body: { pluginName: string; key: string }) => {
    return services.pluginData.removeByKey(body.pluginName, body.key);
  },
  'pluginData.clear': async (body: { pluginName: string }) => {
    return services.pluginData.removeAll(body.pluginName);
  },
  'pluginData.all': async (body: { pluginName: string }) => {
    const docs = (await services.pluginData.all(body.pluginName)) || [];
    return docs.map(d => ({
      value: d.value,
      key: d.key,
    }));
  },
  'cloudCredential.getById': async (body: { id: string }) => {
    return await services.cloudCredential.getById(body.id);
  },
  'cloudCredential.update': async (body: {
    originCredential: CloudProviderCredential;
    patch: Partial<CloudProviderCredential>;
  }) => {
    return await services.cloudCredential.update(body.originCredential, body.patch);
  },
  'settings.get': async () => {
    return await services.settings.get();
  },
  'openInBrowser': async (body: { url: string }) => {
    const { url } = body;
    const { protocol } = new URL(url);
    if (protocol === 'http:' || protocol === 'https:') {
      return shell.openExternal(url);
    }
  },
  'network.sendRequest': async (body: { request: DBRequest; extraInfo?: { requestChain: string[] } }) => {
    const { request, environment, settings, clientCertificates, caCert, timelinePath, responseId } =
      await fetchRequestData(body.request._id);

    const renderResult = await tryToInterpolateRequest({
      request,
      environment: environment._id,
      purpose: 'send',
      extraInfo: body.extraInfo,
    });
    const response = await sendCurlAndWriteTimeline(
      renderResult.request,
      clientCertificates,
      caCert,
      settings,
      timelinePath,
      responseId,
    );
    return await services.response.create({ ...response, bodyCompression: null }, settings.maxHistoryResponses);
  },
  // use libcurl to send request without side effects(do not write to database about request and response)
  'network.sendRequestWithoutSideEffects': async (body: {
    options: {
      request: Pick<DBRequest, 'url' | 'method' | 'headers'> & Partial<Pick<DBRequest, 'body' | 'authentication'>>;
      caCertficatePath: string;
    };
  }) => {
    const requestId = uuidv4();
    const settings = await services.settings.get();
    const settingFollowRedirects = settings?.followRedirects ? 'on' : 'off';
    const { request: originRequest, caCertficatePath = null } = body.options;
    const response = await curlRequest({
      requestId: `no-sideEffects-request-${requestId}`,
      req: {
        authentication: { type: 'none' },
        body: {},
        cookieJar: {
          cookies: [],
        },
        cookies: [],
        suppressUserAgent: false,
        settingFollowRedirects,
        settingRebuildPath: true,
        settingSendCookies: true,
        ...originRequest,
      },
      finalUrl: originRequest.url,
      settings,
      certificates: [],
      caCertficatePath,
    });
    const { headerResults, patch, responseBodyPath } = response;
    if (patch.error) {
      throw new Error(patch.error);
    }
    if (headerResults.length === 0) {
      throw new Error('Error in response: no header result is found');
    }
    const lastRedirect = headerResults[headerResults.length - 1];
    if (!lastRedirect) {
      throw new Error('Error in response: the lastRedirect is not defined');
    }
    const bodyResult = await services.helpers.readCurlResponse({
      bodyPath: responseBodyPath,
      bodyCompression: patch.bodyCompression,
    });
    const result = {
      code: lastRedirect.code,
      reason: lastRedirect.reason,
      headers: lastRedirect.headers,
      responseTime: patch.elapsedTime,
      body: bodyResult.body,
      ok: lastRedirect.code >= 200 && lastRedirect.code < 300,
      status: lastRedirect.reason || RESPONSE_CODE_REASONS[lastRedirect.code] || 'Unknown',
      json: () => {
        try {
          return JSON.parse(bodyResult.body);
        } catch (error) {
          throw new Error(`Error parsing JSON response: ${error}`);
        }
      },
    };
    return new Response(JSON.stringify(result));
  },
  // used to generate the template tags for the bundle plugins and send back to the web worker
  'plugin.getBundlePluginTemplateTags': async () => {
    const appBundlePlugins = getAppBundlePlugins();
    const appBundlePluginTemplateTags: TemplateTag[] = [];
    appBundlePlugins.forEach(p => {
      const { name: pluginName } = p;
      const module = getBundlePluginModule(pluginName);
      const pluginExportedTemplateTags: PluginTemplateTag[] = module?.templateTags || [];
      const pluginTemplateTags: TemplateTag[] = pluginExportedTemplateTags.map(tt => ({
        plugin: {
          name: pluginName,
          description: 'Bundle plugin',
          version: 'Unknown',
          directory: '',
          config: {
            disabled: false,
          },
          permissions: { modules: [], capabilities: [] },
          permissionWarnings: [],
          permissionsDeclared: false,
          module,
        },
        templateTag: tt,
      }));
      appBundlePluginTemplateTags.push(...pluginTemplateTags);
    });
    return appBundlePluginTemplateTags;
  },
  // execute the plugin tag with the given parameters
  'plugin.executeBundlePluginTag': async (body: {
    args: any[];
    pluginName: string;
    tagName: string;
    context: Pick<PluginTemplateTagContext, 'meta' | 'renderPurpose' | 'context'>;
  }) => {
    const { tagName, pluginName } = body;
    const appBundlePluginNames = getAppBundlePlugins().map(p => p.name);
    if (appBundlePluginNames.includes(pluginName)) {
      const module = getBundlePluginModule(pluginName);
      const templateTags = module?.templateTags || [];
      const targetTag = templateTags.find(tag => tag.name === tagName);
      if (targetTag) {
        const settings = await services.settings.get();
        if (settings.templateTagSandboxEnabled) {
          const { ALL_CAPABILITIES } = await import('../templating/sandbox/host-bridge');
          const { ALL_SANDBOX_MODULES } = await import('../templating/sandbox/module-registry');
          // Bundle plugins are first-party and trusted: grant every module + capability.
          return runPluginTagInSandbox(
            readPluginModuleMap({ directory: '', name: pluginName }),
            body,
            [...ALL_SANDBOX_MODULES],
            [...ALL_CAPABILITIES],
          );
        }
        return runPluginTag(targetTag.run, body);
      }
    }
    throw new Error(`Unsupported tag ${tagName} for plugin ${pluginName}`);
  },
  // generate the template tags for user-installed plugins and send back to the web worker.
  // Bundle plugins are handled separately by `plugin.getBundlePluginTemplateTags`.
  'plugin.getUserPluginTemplateTags': async () => {
    const tags = await getTemplateTags();
    // Bundle plugins have an empty `directory`; everything else is user-installed.
    return tags
      .filter(({ plugin }) => plugin.directory !== '')
      .map(({ plugin, templateTag }) => ({
        plugin: {
          name: plugin.name,
          description: plugin.description,
          version: plugin.version,
          directory: plugin.directory,
          config: plugin.config,
        },
        templateTag,
      }));
  },
  // L1: discover a user plugin's exports by evaluating its source in the sandbox (no host execution),
  // returning a serializable manifest. The plugin loader (plugins/index.ts) calls this instead of
  // nodeRequire-ing the module when the sandbox is enabled.
  'plugin.discoverUserPluginExports': async (body: {
    directory: string;
    name: string;
    permissions?: { modules?: string[]; capabilities?: string[] };
  }) => {
    const trusted = await resolveTrustedPlugin(body.name);
    return discoverUserPluginExportsForLoader({
      ...body,
      directory: trusted.directory,
      permissions: trusted.permissions,
    });
  },
  // H1: run a user plugin's request hook in the sandbox (plugin-window path reaches this over the
  // templating-worker-database protocol; the node runtime calls runRequestHookInSandbox directly).
  'plugin.runUserRequestHook': async (body: {
    plugin: { directory: string; name: string; permissions?: { modules?: string[]; capabilities?: string[] } };
    hookIndex: number;
    renderedRequest: Record<string, any>;
    renderContext: Record<string, any>;
  }) => {
    const trusted = await resolveTrustedPlugin(body.plugin.name);
    return runRequestHookInSandbox(
      { ...body.plugin, directory: trusted.directory, permissions: trusted.permissions },
      body.hookIndex,
      body.renderedRequest,
      body.renderContext,
    );
  },
  'plugin.runUserResponseHook': async (body: {
    plugin: { directory: string; name: string; permissions?: { modules?: string[]; capabilities?: string[] } };
    hookIndex: number;
    response: Record<string, any>;
    renderedRequest: Record<string, any>;
    renderContext: Record<string, any>;
  }) => {
    // Resolve directory/permissions from the trusted registry, never the caller-supplied body (#10290).
    const trusted = await resolveTrustedPlugin(body.plugin.name);
    // Refuse to let setBody() redirect its write onto a different, already-persisted response (#10286).
    await assertResponseBodyPathOwnership(body.response);
    return runResponseHookInSandbox(
      { ...body.plugin, directory: trusted.directory, permissions: trusted.permissions },
      body.hookIndex,
      body.response,
      body.renderedRequest,
      body.renderContext,
    );
  },
  // execute a user-installed plugin tag with the given parameters, in the main process where
  // Node built-ins (e.g. crypto) the plugin requires are available.
  'plugin.executeUserPluginTag': async (body: {
    args: any[];
    pluginName: string;
    tagName: string;
    context: Pick<PluginTemplateTagContext, 'meta' | 'renderPurpose' | 'context'>;
  }) => {
    const { tagName, pluginName } = body;
    const tags = await getTemplateTags();
    const targetTag = tags.find(t => t.plugin.name === pluginName && t.templateTag.name === tagName);
    if (targetTag) {
      const settings = await services.settings.get();
      if (settings.templateTagSandboxEnabled) {
        const { resolveTemplateTagModules, resolveTemplateTagCapabilities } = await import(
          '../templating/sandbox/surface-profiles'
        );
        try {
          return await runPluginTagInSandbox(
            readPluginModuleMap({ directory: targetTag.plugin.directory, name: pluginName }),
            body,
            resolveTemplateTagModules(targetTag.plugin.permissions?.modules),
            resolveTemplateTagCapabilities(targetTag.plugin.permissions?.capabilities),
          );
        } catch (err) {
          // Surface a one-time migration hint for manifest-less plugins, then let the denial through.
          maybeWarnMissingManifest(targetTag.plugin, err);
          throw err;
        }
      }
      return runPluginTag(targetTag.templateTag.run, body);
    }
    throw new Error(`Unsupported tag ${tagName} for plugin ${pluginName}`);
  },
  // execute the plugin exported main action with the given parameters
  'plugin.executeBundlePluginMainAction': async (body: {
    pluginName: string;
    actionName: string;
    context?: Record<string, any>;
    params?: Record<string, any>;
  }) => {
    const { pluginName, actionName, context, params } = body;
    const appBundlePluginNames = getAppBundlePlugins().map(p => p.name);
    if (appBundlePluginNames.includes(pluginName)) {
      const module = getBundlePluginModule(pluginName);
      const pluginActions = module?.unsafePluginMainActions || [];
      const targetAction = pluginActions.find(action => action.name === actionName);
      if (targetAction) {
        const commonContext = getPluginCommonContext({ plugin: { name: pluginName } });
        return targetAction.action({ ...commonContext, ...context }, params);
      }
    }
    throw new Error(`Unsupported action named ${actionName} for plugin ${pluginName}`);
  },
  'app.alert': async (body: { title: string; message?: string }) => {
    await dialog.showMessageBox({ type: 'info', title: body.title, message: body.message || '' });
  },
  'app.dialog': async (body: { title: string; message?: string }) => {
    await dialog.showMessageBox({ type: 'info', title: body.title, message: body.message || '' });
  },
  'app.prompt': async (body: { title: string; options?: AppPromptOptions }) => {
    return requestPromptFromRenderer({
      ...body.options,
      title: body.title,
      label: body.options?.label ?? body.title,
      defaultValue: body.options?.defaultValue ?? '',
    });
  },
  'app.getPath': async (body: { name: string }) => {
    return app.getPath(body.name as Parameters<typeof app.getPath>[0]);
  },
  'app.showSaveDialog': async (body: { options?: { defaultPath?: string } }) => {
    const result = await dialog.showSaveDialog(body.options ?? {});
    return result.canceled ? null : result.filePath;
  },
  'app.clipboard.readText': async () => {
    return clipboard.readText();
  },
  'app.clipboard.writeText': async (body: { text: string }) => {
    clipboard.writeText(body.text);
  },
  'app.clipboard.clear': async () => {
    clipboard.clear();
  },
};
