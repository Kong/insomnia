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
  | 'sidebar_showCreateDropdown'
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
  | 'graphql_explorer_focus_filter'
  | 'close_tab'
  | 'tab_nextTab'
  | 'tab_previousTab'
  | 'tab_reopenClosedTab'
  | 'request_openInNewTab';

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

// How far the configured HTTP/HTTPS proxy reaches.
export const ProxyScopes = {
  // Only requests sent from collections use the proxy (default, matches pre-13.1 behavior).
  // Insomnia's own traffic (login, git, Konnect, auto-updates, analytics, etc.) always goes direct.
  requests: 'requests',
  // Every outbound call Insomnia makes, including its own traffic above, uses the proxy.
  all: 'all',
} as const;

export type ProxyScope = ValueOf<typeof ProxyScopes>;

/** Gets a subset of Settings where the values match a condition */
export type SettingsOfType<MatchType> = NonNullable<
  {
    [Key in keyof Settings]: Settings[Key] extends MatchType ? Key : never;
  }[keyof Settings]
>;

export interface PluginConfig {
  disabled: boolean;
  // T1: per-plugin escape hatch. When true, a user plugin runs in-process with full host access
  // instead of the sandbox, even while the sandbox is enabled. Off/absent = sandboxed (default-deny).
  elevated?: boolean;
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

  /** If true, Insomnia won’t show a notification when new updates are available. Users can still check for updates in Preferences. */
  disableUpdateNotification: boolean;

  enableKeyMapForInlineTextEditors: boolean;
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
  hasKonnectPat: boolean;
  konnectOrganizationId: string | null;
  hotKeyRegistry: HotKeyRegistry;
  httpProxy: string;
  httpsProxy: string;
  /** How far the configured proxy reaches — see `ProxyScope`. */
  proxyScope: ProxyScope;
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
  sidebarFocusForCollections: boolean;
  /** True once the user has dismissed the one-time "Welcome to focus mode" onboarding popup. */
  hasSeenSidebarFocusOnboarding: boolean;
  theme: string;
  timeout: number;
  updateAutomatically: boolean;
  updateChannel: UpdateChannel;
  useBulkHeaderEditor: boolean;
  useBulkParametersEditor: boolean;
  /** Edit form-data and url-encoded request bodies as text instead of key-value rows. */
  useBulkFormEditor: boolean;
  validateAuthSSL: boolean;
  validateSSL: boolean;
  // vault related settings
  saveVaultKeyLocally: boolean;
  enableVaultInScripts: boolean;
  saveVaultKeyToOSSecretManager: boolean;
  vaultSecretCacheDuration: number;
  dataFolders: string[];
  // AST and shadowing check.
  scriptSandboxEnabled: boolean;
  // Wraps the user script in 'use strict', preventing accidental globals and making `this` undefined.
  scriptStrictModeEnabled: boolean;
  // PoC/experimental: execute pre-request/after-response scripts inside the QuickJS-WASM sandbox
  // instead of the hidden Electron BrowserWindow. Supports only a minimal API surface (console,
  // insomnia.environment/variables get/set, read-only insomnia.request) — insomnia.sendRequest()
  // and insomnia.test()/pm.test() are not yet bridged and throw if called. Defaults to off so the
  // full-featured hidden-window sandbox remains the default execution path.
  useQuickJsScriptSandbox: boolean;
  // T1: sandbox ALL untrusted (user) plugin surfaces — template tags, request/response hooks, actions,
  // and load-time module code — inside the QuickJS-WASM sandbox. User plugins are default-deny;
  // per-plugin `pluginConfig.elevated` opts an individual plugin back into full-host in-process
  // execution. Bundle plugins are always trusted.
  pluginSandboxEnabled: boolean;
  // Names of security rules that have been individually disabled.
  disabledSecurityRules: string[];
  // AST blocked-property names that have been individually disabled.
  disabledBlockedProperties: string[];
  // AST blocked-root names that have been individually disabled.
  disabledBlockedRoots: string[];
  /** Custom npm registry URL for plugin installation (e.g., corporate mirror). Empty string uses the default https://registry.npmjs.org/. */
  npmRegistryUrl: string;
}
