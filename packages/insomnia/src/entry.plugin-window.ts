import { ipcRenderer } from 'electron';

import type { Plugin } from './plugins/index';
import {
  getActivePlugins,
  getDocumentActions,
  getPlugins,
  getRequestActions,
  getRequestGroupActions,
  getThemes,
  getWorkspaceActions,
  reloadPlugins,
} from './plugins/index';

interface PluginInvokeMessage {
  id: string;
  method: string;
  args: unknown;
}

function serializePlugin(p: Plugin) {
  return {
    name: p.name,
    description: p.description,
    version: p.version,
    directory: p.directory,
    config: p.config,
  };
}

ipcRenderer.on('plugin-invoke', async (_event, { id, method }: PluginInvokeMessage) => {
  try {
    let result: unknown;

    switch (method) {
      case 'getThemes': {
        const themes = await getThemes();
        result = themes.map(({ plugin, theme }) => ({ plugin: serializePlugin(plugin), theme }));
        break;
      }

      case 'getPlugins': {
        const plugins = await getPlugins();
        result = plugins.map(serializePlugin);
        break;
      }

      case 'getActivePlugins': {
        const plugins = await getActivePlugins();
        result = plugins.map(serializePlugin);
        break;
      }

      case 'reloadPlugins': {
        await reloadPlugins();
        result = null;
        break;
      }

      case 'getRequestActions': {
        const actions = await getRequestActions();
        result = actions.map(a => ({ label: a.label, icon: a.icon, pluginName: a.plugin.name }));
        break;
      }

      case 'getRequestGroupActions': {
        const actions = await getRequestGroupActions();
        result = actions.map(a => ({ label: a.label, icon: a.icon, pluginName: a.plugin.name }));
        break;
      }

      case 'getWorkspaceActions': {
        const actions = await getWorkspaceActions();
        result = actions.map(a => ({ label: a.label, icon: a.icon, pluginName: a.plugin.name }));
        break;
      }

      case 'getDocumentActions': {
        const actions = await getDocumentActions();
        result = actions.map(a => ({ label: a.label, hideAfterClick: a.hideAfterClick, pluginName: a.plugin.name }));
        break;
      }

      default: {
        throw new Error(`[plugin-window] Unknown method: ${method}`);
      }
    }

    ipcRenderer.send('plugin-invoke-result', { id, result });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[plugin-window] Error in ${(error as any)?.method ?? method}: ${errMsg}`);
    ipcRenderer.send('plugin-invoke-result', { id, error: errMsg });
  }
});

ipcRenderer.send('plugin-window-ready');
