import { ipcRenderer } from 'electron';
import { initDatabase, initServices } from 'insomnia-data';

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
    // F1: this window has its own JS realm (nodeIntegration, no contextBridge) and so its own copy
    // of the templating-db auth token module state — fetch it directly over IPC before any plugin
    // code can call `fetchFromTemplateWorkerDatabase`.
    setTemplatingDbAuthToken(await ipcRenderer.invoke('templatingDb.getAuthToken'));
    await initDatabase(pluginWindowDatabase);
    initServices(servicesProxy);
    initRuntime(rendererRuntime);
    ipcRenderer.send('plugins.windowReady');
  } catch (err) {
    console.error('[plugin-window] Initialization failed:', err);
  }
})();
