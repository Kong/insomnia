import type { PluginBridgeMetrics, PluginsBridgeAPI } from './bridge-types';

// Phase 1a rollback switch: set INSOMNIA_ENABLE_PLUGIN_BRIDGE=false to fall
// back to running plugins directly in the renderer (legacy behaviour).
// This module lives in the renderer bundle (not the preload) so the heavy
// plugin-system deps it pulls in don't inflate the preload.
const bridgeEnabled = process.env.INSOMNIA_ENABLE_PLUGIN_BRIDGE !== 'false';

async function call<M extends keyof Omit<PluginsBridgeAPI, 'getBridgeMetrics'>>(
  method: M,
  args?: Parameters<PluginsBridgeAPI[M]>[0],
): Promise<Awaited<ReturnType<PluginsBridgeAPI[M]>>> {
  if (bridgeEnabled) {
    const fn = (window.main.plugins[method] as (...a: any[]) => any);
    return fn(args) as Promise<Awaited<ReturnType<PluginsBridgeAPI[M]>>>;
  }

  const { invokePluginMethod } = await import('./invoke-method');
  return invokePluginMethod(method as any, args) as Promise<Awaited<ReturnType<PluginsBridgeAPI[M]>>>;
}

const emptyBridgeMetrics: PluginBridgeMetrics = {
  windowStartups: 0,
  windowCrashes: 0,
  windowStartupMsLast: null,
  windowReady: false,
  pendingInvocations: 0,
  perMethod: {},
};

export const plugins: PluginsBridgeAPI = {
  getThemes: () => call('getThemes'),
  getPlugins: () => call('getPlugins'),
  getActivePlugins: () => call('getActivePlugins'),
  reloadPlugins: () => call('reloadPlugins'),
  getRequestActions: () => call('getRequestActions'),
  getRequestGroupActions: () => call('getRequestGroupActions'),
  getWorkspaceActions: () => call('getWorkspaceActions'),
  getDocumentActions: () => call('getDocumentActions'),
  executeAction: args => call('executeAction', args),
  getTemplateTags: () => call('getTemplateTags'),
  runTemplateTagAction: args => call('runTemplateTagAction', args),
  getBundlePlugins: () => call('getBundlePlugins'),
  executePluginMainAction: args => call('executePluginMainAction', args),
  hasRequestHooks: () => call('hasRequestHooks'),
  hasResponseHooks: () => call('hasResponseHooks'),
  applyRequestHooks: args => call('applyRequestHooks', args),
  applyResponseHooks: args => call('applyResponseHooks', args),
  getBridgeMetrics: () =>
    bridgeEnabled
      ? window.main.plugins.getBridgeMetrics()
      : Promise.resolve(emptyBridgeMetrics),
};
