import type { BinaryToTextEncoding } from 'node:crypto';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { app, clipboard, dialog, shell } from 'electron';
import iconv from 'iconv-lite';
import type { AllTypes, CloudProviderCredential, Request as DBRequest, RequestGroup, Workspace } from 'insomnia-data';
import { services } from 'insomnia-data';
import { v4 as uuidv4 } from 'uuid';

import { jarFromCookies } from '~/common/cookies';
import { type Plugin, type TemplateTag } from '~/common/plugins/types';
import type { PluginTemplateTag, PluginTemplateTagContext, PluginToMainAPIPaths } from '~/common/templating/types';
import { getPluginCommonContext, getTemplateTags } from '~/plugins';

import { getAppBundlePlugins, RESPONSE_CODE_REASONS } from '../common/constants';
import { isDevelopment } from '../common/constants';
import { database as db } from '../common/database';
import { fetchRequestData, sendCurlAndWriteTimeline, tryToInterpolateRequest } from '../network/network';
import { curlRequest } from './network/libcurl-promise';
import { requestPromptFromRenderer } from './prompt-bridge';
import { secureReadFile } from './secure-read-file';

const bundlePluginModuleMap: Record<string, Plugin['module']> = {};

export const resolveDbByKey = async (request: Request) => {
  const url = new URL(request.url);
  let body;
  try {
    // We expect this to throw if a db call returns undefined
    body = await request.json();
  } catch {}
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
    return new Response(JSON.stringify(result));
  } catch (err) {
    console.error(`Error resolving db by key ${urlHostLowerCase}:`, err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
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

// Execute a plugin template tag inside the QuickJS-WASM sandbox instead of directly in the main
// process. The host bridge reuses the existing pluginToMainAPI handlers verbatim, plus a util.render
// handler that recurses through main templating. Gated behind the templateTagSandboxEnabled setting.
export const runPluginTagInSandbox = async (
  pluginSource: string,
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
  const { createMapBridge, filterByCapabilities, TEMPLATE_TAG_BASELINE_CAPABILITIES } = await import(
    '../templating/sandbox/host-bridge'
  );
  const { TEMPLATE_TAG_BASELINE_MODULES } = await import('../templating/sandbox/module-registry');
  const { pluginName, tagName, args, context: originContext } = body;
  const { meta, renderPurpose, context } = originContext;
  const capabilities = grantedCapabilities ?? [...TEMPLATE_TAG_BASELINE_CAPABILITIES];
  // Gate the handler map by capability before building the bridge: an ungranted path rejects at the
  // bridge with a message naming the missing capability, rather than silently running.
  const bridge = createMapBridge(
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
  return runTagInSandbox({
    pluginSource,
    tagName,
    bridge,
    // node:crypto is synchronous and available in main, so back the sandbox's require('crypto')
    // shim with it via sync host functions rather than the async bridge.
    hostCrypto: {
      hash: (algo, data, inputEncoding, outputEncoding) =>
        crypto
          .createHash(algo)
          .update(data, inputEncoding as crypto.Encoding)
          .digest(outputEncoding as BinaryToTextEncoding),
      hmac: (algo, key, data, outputEncoding) =>
        crypto
          .createHmac(algo, key)
          .update(data, 'utf8')
          .digest(outputEncoding as BinaryToTextEncoding),
      randomBytes: (size: number) => crypto.randomBytes(size).toString('base64'),
      randomUUID: () => crypto.randomUUID(),
    },
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
    },
  });
};

// These are exposed to the templating worker and can be used by plugins from context.util
const pluginToMainAPI: Record<PluginToMainAPIPaths, (...args: any[]) => Promise<any>> = {
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
    return await services.helpers.getResponseBodyBuffer(body.response, body.readFailureValue);
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
            getPluginEntrySource({ directory: '', name: pluginName }),
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
        const { resolveTemplateTagModules } = await import('../templating/sandbox/module-registry');
        const { resolveTemplateTagCapabilities } = await import('../templating/sandbox/host-bridge');
        return runPluginTagInSandbox(
          getPluginEntrySource({ directory: targetTag.plugin.directory, name: pluginName }),
          body,
          resolveTemplateTagModules(targetTag.plugin.permissions?.modules),
          resolveTemplateTagCapabilities(targetTag.plugin.permissions?.capabilities),
        );
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
  'app.prompt': async (body: { title: string; options?: { label?: string; defaultValue?: string } }) => {
    return requestPromptFromRenderer({
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
