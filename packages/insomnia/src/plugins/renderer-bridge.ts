import type { PluginsBridgeAPI } from './bridge-types';

function call<M extends keyof Omit<PluginsBridgeAPI, 'getBridgeMetrics'>>(
  method: M,
  args?: Parameters<PluginsBridgeAPI[M]>[0],
): ReturnType<PluginsBridgeAPI[M]> {
  const bridge = window.main?.plugins;
  if (bridge?.[method]) {
    const fn = bridge[method] as (...a: any[]) => any;
    return fn(args) as ReturnType<PluginsBridgeAPI[M]>;
  }

  return import('./invoke-method').then(({ invokePluginMethod }) =>
    invokePluginMethod(method, args),
  ) as ReturnType<PluginsBridgeAPI[M]>;
}

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
  applyHarRequestHooks: args => call('applyHarRequestHooks', args),
  applyResponseHooks: args => call('applyResponseHooks', args),
  getBridgeMetrics: () => window.main.plugins.getBridgeMetrics(),
};
