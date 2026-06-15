import { deserializeRenderContext } from '../templating/render-context-serialization';
import type {
  ApplyRequestHooksArgs,
  ApplyResponseHooksArgs,
  ExecutePluginActionArgs,
  ExecutePluginMainActionArgs,
  RunTemplateTagActionArgs,
} from './bridge-types';
import * as pluginApp from './context/app';
import * as pluginData from './context/data';
import * as pluginNetwork from './context/network';
import * as pluginRequest from './context/request';
import * as pluginResponse from './context/response';
import * as pluginStore from './context/store';
import {
  executePluginMainAction,
  getActivePlugins,
  getBundlePlugins,
  getDocumentActions,
  getPlugins,
  getRequestActions,
  getRequestGroupActions,
  getRequestHooks,
  getResponseHooks,
  getTemplateTags,
  getThemes,
  getWorkspaceActions,
  reloadPlugins,
} from './index';
import type { Plugin } from './types';

export type PluginInvokeMethod =
  | 'getThemes'
  | 'getPlugins'
  | 'getActivePlugins'
  | 'reloadPlugins'
  | 'getRequestActions'
  | 'getRequestGroupActions'
  | 'getWorkspaceActions'
  | 'getDocumentActions'
  | 'executeAction'
  | 'getTemplateTags'
  | 'runTemplateTagAction'
  | 'getBundlePlugins'
  | 'executePluginMainAction'
  | 'hasRequestHooks'
  | 'hasResponseHooks'
  | 'applyRequestHooks'
  | 'applyResponseHooks';

function serializePlugin(p: Plugin) {
  return {
    name: p.name,
    description: p.description,
    version: p.version,
    directory: p.directory,
    config: p.config,
  };
}

export async function invokePluginMethod(method: PluginInvokeMethod, args?: unknown): Promise<unknown> {
  switch (method) {
    case 'getThemes': {
      const themes = await getThemes();
      return themes.map(({ plugin, theme }) => ({ plugin: serializePlugin(plugin), theme }));
    }

    case 'getPlugins': {
      const plugins = await getPlugins();
      return plugins.map(serializePlugin);
    }

    case 'getActivePlugins': {
      const plugins = await getActivePlugins();
      return plugins.map(serializePlugin);
    }

    case 'reloadPlugins': {
      await reloadPlugins();
      return null;
    }

    case 'getRequestActions': {
      const actions = await getRequestActions();
      return actions.map(a => ({ label: a.label, icon: a.icon, pluginName: a.plugin.name }));
    }

    case 'getRequestGroupActions': {
      const actions = await getRequestGroupActions();
      return actions.map(a => ({ label: a.label, icon: a.icon, pluginName: a.plugin.name }));
    }

    case 'getWorkspaceActions': {
      const actions = await getWorkspaceActions();
      return actions.map(a => ({ label: a.label, icon: a.icon, pluginName: a.plugin.name }));
    }

    case 'getDocumentActions': {
      const actions = await getDocumentActions();
      return actions.map(a => ({ label: a.label, hideAfterClick: a.hideAfterClick, pluginName: a.plugin.name }));
    }

    case 'executeAction': {
      const { type, pluginName, label, projectId, domainData } = args as ExecutePluginActionArgs;

      let allActions: any[];
      switch (type) {
        case 'request': {
          allActions = await getRequestActions();
          break;
        }
        case 'requestGroup': {
          allActions = await getRequestGroupActions();
          break;
        }
        case 'workspace': {
          allActions = await getWorkspaceActions();
          break;
        }
        case 'document': {
          allActions = await getDocumentActions();
          break;
        }
        default: {
          throw new Error(`[plugin-window] Unknown action type: ${type}`);
        }
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
      return null;
    }

    case 'getBundlePlugins': {
      const plugins = await getBundlePlugins();
      return plugins.map(serializePlugin);
    }

    case 'executePluginMainAction': {
      return executePluginMainAction(args as ExecutePluginMainActionArgs);
    }

    case 'getTemplateTags': {
      const tags = await getTemplateTags();
      return tags.map(({ plugin, templateTag }) => ({
        pluginName: plugin.name,
        // eslint-disable-next-line unicorn/prefer-structured-clone
        templateTag: JSON.parse(JSON.stringify(templateTag)),
      }));
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
      return null;
    }

    case 'hasRequestHooks': {
      const hooks = await getRequestHooks();
      return hooks.length > 0;
    }

    case 'hasResponseHooks': {
      const hooks = await getResponseHooks();
      return hooks.length > 0;
    }

    case 'applyRequestHooks': {
      const { renderedRequest, projectId, environment } = args as ApplyRequestHooksArgs;
      const newRenderedRequest = { ...renderedRequest };
      const renderedContext = deserializeRenderContext(environment);

      for (const { plugin, hook } of await getRequestHooks()) {
        const context = {
          ...pluginApp.init(),
          ...pluginData.init(projectId),
          ...(pluginStore.init(plugin) as Record<string, any>),
          ...(pluginRequest.init(newRenderedRequest as any, renderedContext) as Record<string, any>),
          ...(pluginNetwork.init() as Record<string, any>),
        };
        try {
          await hook(context);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          throw new Error(`[plugin=${plugin.name}] ${error.message}`);
        }
      }

      return newRenderedRequest;
    }

    case 'applyResponseHooks': {
      const { response, renderedRequest, projectId, environment } = args as ApplyResponseHooksArgs;
      const newResponse = { ...response };
      const newRequest = { ...renderedRequest };
      const renderedContext = deserializeRenderContext(environment);

      for (const { plugin, hook } of await getResponseHooks()) {
        const context = {
          ...pluginApp.init(),
          ...pluginData.init(projectId),
          ...(pluginStore.init(plugin) as Record<string, any>),
          ...(pluginResponse.init(newResponse) as Record<string, any>),
          ...(pluginRequest.init(newRequest as any, renderedContext, true) as Record<string, any>),
          ...(pluginNetwork.init() as Record<string, any>),
        };
        try {
          await hook(context);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          throw new Error(`[plugin=${plugin.name}] ${error.message}`);
        }
      }

      return newResponse;
    }

    default: {
      throw new Error(`[plugin-window] Unknown method: ${method}`);
    }
  }
}
