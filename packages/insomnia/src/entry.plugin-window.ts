import { ipcRenderer } from 'electron';

import type { ExecutePluginActionArgs, ExecutePluginMainActionArgs, RunTemplateTagActionArgs } from './plugins/bridge-types';
import * as pluginApp from './plugins/context/app';
import * as pluginData from './plugins/context/data';
import * as pluginNetwork from './plugins/context/network';
import * as pluginStore from './plugins/context/store';
import type { Plugin } from './plugins/index';
import {
  executePluginMainAction,
  getActivePlugins,
  getBundlePlugins,
  getDocumentActions,
  getPlugins,
  getRequestActions,
  getRequestGroupActions,
  getTemplateTags,
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

ipcRenderer.on('plugin-invoke', async (_event, { id, method, args }: PluginInvokeMessage) => {
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

      case 'executeAction': {
        const { type, pluginName, label, projectId, domainData } = args as ExecutePluginActionArgs;

        let allActions: any[];
        switch (type) {
          case 'request': allActions = await getRequestActions(); break;
          case 'requestGroup': allActions = await getRequestGroupActions(); break;
          case 'workspace': allActions = await getWorkspaceActions(); break;
          case 'document': allActions = await getDocumentActions(); break;
          default: throw new Error(`[plugin-window] Unknown action type: ${type}`);
        }

        const entry = allActions.find(a => a.plugin.name === pluginName && a.label === label);
        if (!entry) {
          throw new Error(`[plugin-window] Action not found: ${pluginName}/${label}`);
        }

        const context = {
          ...pluginApp.init(),
          ...pluginData.init(projectId),
          ...(pluginStore.init(entry.plugin) as Record<string, any>),
          ...(pluginNetwork.init() as Record<string, any>),
        };

        await entry.action(context, domainData);
        result = null;
        break;
      }

      case 'getBundlePlugins': {
        const plugins = await getBundlePlugins();
        result = plugins.map(serializePlugin);
        break;
      }

      case 'executePluginMainAction': {
        const actionArgs = args as ExecutePluginMainActionArgs;
        result = await executePluginMainAction(actionArgs);
        break;
      }

      case 'getTemplateTags': {
        const tags = await getTemplateTags();
        result = tags.map(({ plugin, templateTag }) => ({
          pluginName: plugin.name,
          // eslint-disable-next-line unicorn/prefer-structured-clone
          templateTag: JSON.parse(JSON.stringify(templateTag)),
        }));
        break;
      }

      case 'runTemplateTagAction': {
        const { pluginName, tagName, actionName } = args as RunTemplateTagActionArgs;
        const tags = await getTemplateTags();
        const tag = tags.find(t => t.plugin.name === pluginName && t.templateTag.name === tagName);
        if (!tag) {
          throw new Error(`[plugin-window] Template tag not found: ${pluginName}/${tagName}`);
        }
        const action = tag.templateTag.actions?.find((a: any) => a.name === actionName);
        if (!action) {
          throw new Error(`[plugin-window] Tag action not found: ${actionName}`);
        }
        await action.run(pluginStore.init(tag.plugin));
        result = null;
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
