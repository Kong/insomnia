import type { PluginsBridgeAPI } from './bridge-types';

function call<M extends keyof Omit<PluginsBridgeAPI, 'getBridgeMetrics'>>(
  method: M,
  args?: Parameters<PluginsBridgeAPI[M]>[0],
): ReturnType<PluginsBridgeAPI[M]> {
  const fn = (window.main.plugins[method] as (...a: any[]) => any);
  return fn(args) as ReturnType<PluginsBridgeAPI[M]>;
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
  applyResponseHooks: args => call('applyResponseHooks', args),
  getBridgeMetrics: () => window.main.plugins.getBridgeMetrics(),
};
