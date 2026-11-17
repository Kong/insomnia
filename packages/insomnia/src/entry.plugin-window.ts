import { ipcRenderer } from 'electron';
import type { FeatureList } from 'insomnia-api';
import { initDatabase, initServices } from 'insomnia-data';

import { setCurrentOrganizationFeatures } from './common/organization-features';
import { setTemplatingDbAuthToken } from './common/templating/liquid-extension-worker';
import { pluginWindowDatabase } from './main/database.plugin-window';
import { invokePluginMethod } from './plugins/invoke-method';
import { initRuntime } from './runtimes';
import { rendererRuntime } from './runtimes/runtime.renderer';
import { servicesProxy } from './ui/renderer-services-proxy';

interface PluginInvokeMessage {
  id: string;
  method: Parameters<typeof invokePluginMethod>[0];
  args: unknown;
}

// Main forwards the current organization's features on change and when this window becomes ready,
// so plugin `context.network.sendRequest` honours organization-enforced secret hiding.
ipcRenderer.on('organizationFeatures.sync', (_event, features?: FeatureList) => {
  setCurrentOrganizationFeatures(features);
});

ipcRenderer.on('plugins.invoke', async (_event, { id, method, args }: PluginInvokeMessage) => {
  try {
    const result = await invokePluginMethod(method, args);
    ipcRenderer.send('plugins.invokeResult', { id, result });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[plugin-window] Error in ${(error as any)?.method ?? method}: ${errMsg}`);
    ipcRenderer.send('plugins.invokeResult', { id, error: errMsg });
  }
});

// Initialize database (via IPC proxy) and services before signalling readiness.
// getPlugins() calls services.settings.get(), which requires this to be done first.
(async () => {
  try {
    // Fetch the auth token before any plugin code can call fetchFromTemplateWorkerDatabase.
    setTemplatingDbAuthToken(await ipcRenderer.invoke('templatingDb.getAuthToken'));
    await initDatabase(pluginWindowDatabase);
    initServices(servicesProxy);
    initRuntime(rendererRuntime);
    ipcRenderer.send('plugins.windowReady');
  } catch (err) {
    console.error('[plugin-window] Initialization failed:', err);
  }
})();
