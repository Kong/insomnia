import type { RenderedRequest } from '~/common/templating/types';
import type { ResponsePatch } from '~/main/network/libcurl-promise';

export type HexColor = `#${string}`;
export type RGBColor = `rgb(${string})`;
export type RGBAColor = `rgba(${string})`;

export type ThemeColor = HexColor | RGBColor | RGBAColor;

// notice that for each sub-block (`background`, `foreground`, `highlight`) the `default` key is required if the sub-block is present
export interface ThemeBlock {
  background?: {
    default: ThemeColor;
    success?: ThemeColor;
    notice?: ThemeColor;
    warning?: ThemeColor;
    danger?: ThemeColor;
    surprise?: ThemeColor;
    info?: ThemeColor;
  };
  foreground?: {
    default: ThemeColor;
    success?: ThemeColor;
    notice?: ThemeColor;
    warning?: ThemeColor;
    danger?: ThemeColor;
    surprise?: ThemeColor;
    info?: ThemeColor;
  };
  highlight?: {
    default: ThemeColor;
    xxs?: ThemeColor;
    xs?: ThemeColor;
    sm?: ThemeColor;
    md?: ThemeColor;
    lg?: ThemeColor;
    xl?: ThemeColor;
  };
}

export interface StylesThemeBlocks {
  appHeader?: ThemeBlock;
  dialog?: ThemeBlock;
  dialogFooter?: ThemeBlock;
  dialogHeader?: ThemeBlock;
  dropdown?: ThemeBlock;
  editor?: ThemeBlock;
  link?: ThemeBlock;
  overlay?: ThemeBlock;
  pane?: ThemeBlock;
  paneHeader?: ThemeBlock;
  sidebar?: ThemeBlock;
  sidebarHeader?: ThemeBlock;
  sidebarList?: ThemeBlock;

  /** does not respect parent wrapping theme */
  tooltip?: ThemeBlock;

  transparentOverlay?: ThemeBlock;
}

export type ThemeInner = ThemeBlock & {
  rawCss?: string;
  styles?: StylesThemeBlocks | null;
};

export interface PluginTheme {
  /** this name is used to generate CSS classes, and must be lower case and must not contain whitespace */
  name: string;
  displayName: string;
  theme: ThemeInner;
}

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

export interface SerializableTemplateTagMeta {
  pluginName: string;
  templateTag: Record<string, unknown>;
}

export interface RunTemplateTagActionArgs {
  pluginName: string;
  tagName: string;
  actionName: string;
}

export type PluginActionType = 'request' | 'requestGroup' | 'workspace' | 'document';

export interface ExecutePluginActionArgs {
  type: PluginActionType;
  pluginName: string;
  label: string;
  projectId: string;
  domainData: unknown;
}

export interface ApplyRequestHooksArgs {
  renderedRequest: RenderedRequest;
  projectId: string;
  environment: Record<string, any>;
}

export interface ApplyResponseHooksArgs {
  response: ResponsePatch;
  renderedRequest: RenderedRequest;
  projectId: string;
  environment: Record<string, any>;
}

export interface ExecutePluginMainActionArgs {
  pluginName: string;
  actionName: string;
  context?: Record<string, any>;
  params?: Record<string, any>;
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
  getTemplateTags: () => Promise<SerializableTemplateTagMeta[]>;
  runTemplateTagAction: (args: RunTemplateTagActionArgs) => Promise<void>;
  getBundlePlugins: () => Promise<SerializablePlugin[]>;
  executePluginMainAction: (args: ExecutePluginMainActionArgs) => Promise<unknown>;
  hasRequestHooks: () => Promise<boolean>;
  hasResponseHooks: () => Promise<boolean>;
  applyRequestHooks: (args: ApplyRequestHooksArgs) => Promise<RenderedRequest>;
  applyResponseHooks: (args: ApplyResponseHooksArgs) => Promise<ResponsePatch>;
  getBridgeMetrics: () => Promise<PluginBridgeMetrics>;
}

export interface PluginBridgeMethodMetrics {
  ok: number;
  error: number;
  timeout: number;
  totalDurationMs: number;
  maxDurationMs: number;
  avgDurationMs: number;
}

export interface PluginBridgeMetrics {
  windowStartups: number;
  windowCrashes: number;
  windowStartupMsLast: number | null;
  windowReady: boolean;
  pendingInvocations: number;
  perMethod: Record<string, PluginBridgeMethodMetrics>;
}
