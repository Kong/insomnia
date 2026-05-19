import { ipcRenderer } from 'electron';

import { initDatabase, initServices } from '~/insomnia-data';
import { servicesNodeImpl } from '~/insomnia-data/node';

import { pluginWindowDatabase } from './main/database.plugin-window';
import { invokePluginMethod } from './plugins/invoke-method';

interface PluginInvokeMessage {
  id: string;
  method: Parameters<typeof invokePluginMethod>[0];
  args: unknown;
}

ipcRenderer.on('plugin-invoke', async (_event, { id, method, args }: PluginInvokeMessage) => {
  try {
    const result = await invokePluginMethod(method, args);
    ipcRenderer.send('plugin-invoke-result', { id, result });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[plugin-window] Error in ${(error as any)?.method ?? method}: ${errMsg}`);
    ipcRenderer.send('plugin-invoke-result', { id, error: errMsg });
  }
});

// Initialize database (via IPC proxy) and services before signalling readiness.
// getPlugins() calls services.settings.get(), which requires this to be done first.
(async () => {
  try {
    await initDatabase(pluginWindowDatabase);
    initServices(servicesNodeImpl);
    ipcRenderer.send('plugin-window-ready');
  } catch (err) {
    console.error('[plugin-window] Initialization failed:', err);
  }
})();
