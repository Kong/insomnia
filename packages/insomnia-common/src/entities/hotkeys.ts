/**
 * The combination of key presses that will activate a hotkey if pressed.
 */
export interface KeyCombination {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  keyCode: number;
}

/**
 * The collection of a hotkey's key combinations for each platforms.
 */
export interface KeyBindings {
  macKeys: KeyCombination[];
  // The key combinations for both Windows and Linux.
  winLinuxKeys: KeyCombination[];
}

/**
 * The collection of defined hotkeys.
 * The registry maps a hotkey by its reference id to its key bindings.
 */
export type HotKeyRegistry = Record<string, KeyBindings>;
