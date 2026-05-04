import type { PluginTheme } from './misc';

export interface SerializablePlugin {
  name: string;
  description: string;
  version: string;
  directory: string;
  config: { disabled: boolean };
}

export interface SerializableTheme {
  plugin: SerializablePlugin;
  theme: PluginTheme;
}

export interface SerializableActionMeta {
  label: string;
  icon?: string;
  pluginName: string;
}

export interface SerializableDocumentActionMeta {
  label: string;
  pluginName: string;
  hideAfterClick?: boolean;
}

export type PluginActionType = 'request' | 'requestGroup' | 'workspace' | 'document';

export interface ExecutePluginActionArgs {
  type: PluginActionType;
  pluginName: string;
  label: string;
  projectId: string;
  domainData: unknown;
}

export interface PluginsBridgeAPI {
  getThemes: () => Promise<SerializableTheme[]>;
  getPlugins: () => Promise<SerializablePlugin[]>;
  getActivePlugins: () => Promise<SerializablePlugin[]>;
  reloadPlugins: () => Promise<void>;
  getRequestActions: () => Promise<SerializableActionMeta[]>;
  getRequestGroupActions: () => Promise<SerializableActionMeta[]>;
  getWorkspaceActions: () => Promise<SerializableActionMeta[]>;
  getDocumentActions: () => Promise<SerializableDocumentActionMeta[]>;
  executeAction: (args: ExecutePluginActionArgs) => Promise<void>;
}
