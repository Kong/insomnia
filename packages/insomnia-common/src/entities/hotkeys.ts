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
  | 'request_showRecent'
  | 'request_showRecentPrevious'
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
