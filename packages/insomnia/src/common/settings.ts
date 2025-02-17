import type { ValueOf } from 'type-fest';

/**
 * The readable definition of a hotkey.
 */
export interface KeyboardShortcutDefinition {
  id: string;
  description: string;
}

/**
 * The combination of key presses that will activate a hotkey if pressed.
 */
export interface KeyCombination {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  keyCode: number;
}

/**
 * The collection of a hotkey's key combinations for each platforms.
 */
export interface PlatformKeyCombinations {
  macKeys: KeyCombination[];
  // The key combinations for both Windows and Linux.
  winLinuxKeys: KeyCombination[];
}

export type KeyboardShortcut =
  | 'workspace_showSettings'
  | 'request_showSettings'
  | 'preferences_showKeyboardShortcuts'
  | 'preferences_showGeneral'
  | 'request_quickSwitch'
  | 'plugin_reload'
  | 'showAutocomplete'
  | 'request_send'
  | 'request_showOptions'
  | 'environment_showEditor'
  | 'environment_showSwitchMenu'
  | 'request_toggleHttpMethodMenu'
  | 'request_toggleHistory'
  | 'request_focusUrl'
  | 'request_showGenerateCodeEditor'
  | 'sidebar_focusFilter'
  | 'sidebar_toggle'
  | 'response_focus'
  | 'showCookiesEditor'
  | 'request_createHTTP'
  | 'request_showDelete'
  | 'request_showCreateFolder'
  | 'request_showDuplicate'
  | 'request_togglePin'
  | 'environment_showVariableSourceAndValue'
  | 'beautifyRequestBody'
  | 'graphql_explorer_focus_filter';

/**
 * The collection of defined hotkeys.
 * The registry maps a hotkey by its reference id to its key bindings.
 */
export type HotKeyRegistry = Record<KeyboardShortcut, PlatformKeyCombinations>;

// HTTP version codes
export const HttpVersions = {
  V1_0: 'V1_0',
  V1_1: 'V1_1',
  V2PriorKnowledge: 'V2PriorKnowledge',
  V2_0: 'V2_0',
  v3: 'v3',
  default: 'default',
} as const;

export type HttpVersion = ValueOf<typeof HttpVersions>;

export enum UpdateChannel {
  stable = 'stable',
  beta = 'beta',
}

/** Gets a subset of Settings where the values match a condition */
export type SettingsOfType<MatchType> = NonNullable<{
  [Key in keyof Settings]: Settings[Key] extends MatchType ? Key : never;
}[keyof Settings]>;

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

  disableAppVersionUserAgent: boolean;

  /** If true, Insomnia won’t show a notification when new updates are available. Users can still check for updates in Preferences. */
  disableUpdateNotification: boolean;
  editorFontSize: number;
  editorIndentSize: number;
  editorIndentWithTabs: boolean;
  editorKeyMap: string;
  editorLineWrapping: boolean;

  /** If true, Insomnia will send anonymous data about features and plugins used. */
  enableAnalytics: boolean;
  filterResponsesByEnv: boolean;
  followRedirects: boolean;
  fontInterface: string | null;
  fontMonospace: string | null;
  fontSize: number;
  fontVariantLigatures: boolean;
  forceVerticalLayout: boolean;
  hotKeyRegistry: HotKeyRegistry;
  httpProxy: string;
  httpsProxy: string;
  showVariableSourceAndValue: boolean;
  lightTheme: string;
  lineWrapping?: boolean;
  maxHistoryResponses: number;
  maxRedirects: number;
  maxTimelineDataSizeKB: number;
  noProxy: string;
  nunjucksPowerUserMode: boolean;
  pluginConfig: PluginConfigMap;
  pluginNodeExtraCerts: string;
  pluginPath: string;
  preferredHttpVersion: HttpVersion;
  proxyEnabled: boolean;
  showPasswords: boolean;
  theme: string;
  timeout: number;
  updateAutomatically: boolean;
  updateChannel: UpdateChannel;
  useBulkHeaderEditor: boolean;
  useBulkParametersEditor: boolean;
  validateAuthSSL: boolean;
  validateSSL: boolean;
  // vault related settings
  saveVaultKeyLocally: boolean;
  enableVaultInScripts: boolean;
  saveVaultKeyToOSSecretManager: boolean;
}
