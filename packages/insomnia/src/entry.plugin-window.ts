import { ipcRenderer } from 'electron';

import { setTemplatingDbAuthToken } from './common/templating/liquid-extension-worker';
import { initDataBridge } from './data-process/init-data-bridge';
import { invokePluginMethod } from './plugins/invoke-method';
import { initRuntime } from './runtimes';
import { rendererRuntime } from './runtimes/runtime.renderer';

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

// Initialize database (via data-port) and services before signalling readiness.
// getPlugins() calls services.settings.get(), which requires this to be done first.
(async () => {
  try {
    // Fetch the auth token before any plugin code can call fetchFromTemplateWorkerDatabase.
    setTemplatingDbAuthToken(await ipcRenderer.invoke('templatingDb.getAuthToken'));
    await initDataBridge(window.invokeDataPort, {
      database: { init: async () => {}, onChange: () => {} },
    });
    initRuntime(rendererRuntime);
    ipcRenderer.send('plugins.windowReady');
  } catch (err) {
    console.error('[plugin-window] Initialization failed:', err);
  }
})();
