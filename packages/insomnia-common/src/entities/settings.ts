import { HttpVersion } from '../constants';
import { HotKeyRegistry } from './hotkeys';

export interface PluginConfig {
  disabled: boolean;
}

export type PluginConfigMap = Record<string, PluginConfig>;

export interface Settings {
  autoDetectColorScheme: boolean;
  autoHideMenuBar: boolean;
  autocompleteDelay: number;
  clearOAuth2SessionOnRestart: boolean;
  darkTheme: string;
  deviceId: string | null;
  disableHtmlPreviewJs: boolean;
  disableResponsePreviewLinks: boolean;
  disableUpdateNotification: boolean;
  disableUpsells: boolean;
  editorFontSize: number;
  editorIndentSize: number;
  editorIndentWithTabs: boolean;
  editorKeyMap: string;
  editorLineWrapping: boolean;
  enableAnalytics: boolean;
  environmentHighlightColorStyle: string;
  filterResponsesByEnv: boolean;
  followRedirects: boolean;
  fontInterface: string | null;
  fontMonospace: string | null;
  fontSize: number;
  fontVariantLigatures: boolean;
  forceVerticalLayout: boolean;
  hasPromptedAnalytics: boolean;
  hasPromptedOnboarding: boolean;
  hasPromptedToMigrateFromDesigner: boolean;
  hotKeyRegistry: HotKeyRegistry;
  httpProxy: string;
  httpsProxy: string;
  isVariableUncovered?: boolean;
  lightTheme: string;
  lineWrapping?: boolean;
  maxHistoryResponses: number;
  maxRedirects: number;
  maxTimelineDataSizeKB: number;
  noProxy: string;
  nunjucksPowerUserMode: boolean;
  pluginConfig: PluginConfigMap;
  pluginPath: string;
  preferredHttpVersion: HttpVersion;
  proxyEnabled: boolean;
  showPasswords: boolean;
  theme: string;
  timeout: number;
  updateAutomatically: boolean;
  updateChannel: string;
  useBulkHeaderEditor: boolean;
  useBulkParametersEditor: boolean;
  validateAuthSSL: boolean;
  validateSSL: boolean;
}
