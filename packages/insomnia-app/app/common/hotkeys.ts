import { keyboardKeys } from './keyboard-keys';
import { ALT_SYM, CTRL_SYM, isDevelopment, isMac, META_SYM, SHIFT_SYM } from './constants';
import { strings } from './strings';

/**
 * The readable definition of a hotkey.
 * The {@code id} the hotkey's reference id.
 */
export interface HotKeyDefinition {
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

function defineHotKey(id: string, description: string): HotKeyDefinition {
  return {
    id: id,
    description: description,
  };
}

/**
 * The collection of available hotkeys' and their definitions.
 */
// Not using dot, because NeDB prohibits field names to contain dots.
export const hotKeyRefs = {
  WORKSPACE_SHOW_SETTINGS: defineHotKey('workspace_showSettings', `Show ${strings.document.singular} / ${strings.collection.singular} Settings`),
  REQUEST_SHOW_SETTINGS: defineHotKey('request_showSettings', 'Show Request Settings'),
  PREFERENCES_SHOW_KEYBOARD_SHORTCUTS: defineHotKey('preferences_showKeyboardShortcuts', 'Show Keyboard Shortcuts'),
  PREFERENCES_SHOW_GENERAL: defineHotKey('preferences_showGeneral', 'Show App Preferences'),
  TOGGLE_MAIN_MENU: defineHotKey('toggleMainMenu', 'Toggle Main Menu'),
  REQUEST_QUICK_SWITCH: defineHotKey('request_quickSwitch', 'Switch Requests'),
  SHOW_RECENT_REQUESTS: defineHotKey('request_showRecent', 'Show Recent Requests'),
  SHOW_RECENT_REQUESTS_PREVIOUS: defineHotKey('request_showRecentPrevious', 'Show Recent Requests (Previous)'),
  PLUGIN_RELOAD: defineHotKey('plugin_reload', 'Reload Plugins'),
  SHOW_AUTOCOMPLETE: defineHotKey('showAutocomplete', 'Show Autocomplete'),
  REQUEST_SEND: defineHotKey('request_send', 'Send Request'),
  REQUEST_SHOW_OPTIONS: defineHotKey('request_showOptions', 'Send Request (Options)'),
  ENVIRONMENT_SHOW_EDITOR: defineHotKey('environment_showEditor', 'Show Environment Editor'),
  ENVIRONMENT_SHOW_SWITCH_MENU: defineHotKey('environment_showSwitchMenu', 'Switch Environments'),
  REQUEST_TOGGLE_HTTP_METHOD_MENU: defineHotKey('request_toggleHttpMethodMenu', 'Change HTTP Method'),
  REQUEST_TOGGLE_HISTORY: defineHotKey('request_toggleHistory', 'Show Request History'),
  REQUEST_FOCUS_URL: defineHotKey('request_focusUrl', 'Focus URL'),
  REQUEST_SHOW_GENERATE_CODE_EDITOR: defineHotKey('request_showGenerateCodeEditor', 'Generate Code'),
  SIDEBAR_FOCUS_FILTER: defineHotKey('sidebar_focusFilter', 'Filter Sidebar'),
  SIDEBAR_TOGGLE: defineHotKey('sidebar_toggle', 'Toggle Sidebar'),
  RESPONSE_FOCUS: defineHotKey('response_focus', 'Focus Response'),
  SHOW_COOKIES_EDITOR: defineHotKey('showCookiesEditor', 'Edit Cookies'),
  REQUEST_SHOW_CREATE: defineHotKey('request_showCreate', 'Create Request'),
  REQUEST_QUICK_CREATE: defineHotKey('request_quickCreate', 'Create Request (Quick)'),
  REQUEST_SHOW_DELETE: defineHotKey('request_showDelete', 'Delete Request'),
  REQUEST_SHOW_CREATE_FOLDER: defineHotKey('request_showCreateFolder', 'Create Folder'),
  REQUEST_SHOW_DUPLICATE: defineHotKey('request_showDuplicate', 'Duplicate Request'),
  REQUEST_TOGGLE_PIN: defineHotKey('request_togglePin', 'Pin/Unpin Request'),
  CLOSE_DROPDOWN: defineHotKey('closeDropdown', 'Close Dropdown'),
  CLOSE_MODAL: defineHotKey('closeModal', 'Close Modal'),
  ENVIRONMENT_UNCOVER_VARIABLES: defineHotKey('environment_uncoverVariables', 'Uncover Variables'),
  // Designer-specific
  SHOW_SPEC_EDITOR: defineHotKey('activity_specEditor', 'Show Spec Activity'),
  SHOW_TEST: defineHotKey('activity_test', 'Show Test Activity'),
  SHOW_MONITOR: defineHotKey('activity_monitor', 'Show Monitor Activity'),
  SHOW_HOME: defineHotKey('activity_home', 'Show Home Activity'),
  FILTER_DOCUMENTS: defineHotKey('documents_filter', 'Focus Documents Filter'),
  TOGGLE_DEVTOOLS: defineHotKey('toggle_devtools', 'Toggle Chrome DevTools'),
};

/**
 * The default key bindings values of all available hotkeys.
 */
const defaultRegistry: HotKeyRegistry = {
  [hotKeyRefs.WORKSPACE_SHOW_SETTINGS.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.comma.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.comma.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_SHOW_SETTINGS.id]: {
    macKeys: [
      { alt: true, shift: true, meta: true, keyCode: keyboardKeys.comma.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, alt: true, shift: true, keyCode: keyboardKeys.comma.keyCode },
    ],
  },
  [hotKeyRefs.PREFERENCES_SHOW_KEYBOARD_SHORTCUTS.id]: {
    macKeys: [
      { ctrl: true, shift: true, meta: true, keyCode: keyboardKeys.forwardslash.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.forwardslash.keyCode },
    ],
  },
  [hotKeyRefs.PREFERENCES_SHOW_GENERAL.id]: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.comma.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.comma.keyCode },
    ],
  },
  [hotKeyRefs.TOGGLE_MAIN_MENU.id]: {
    macKeys: [
      { alt: true, meta: true, keyCode: keyboardKeys.comma.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, alt: true, keyCode: keyboardKeys.comma.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_QUICK_SWITCH.id]: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.p.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.p.keyCode },
    ],
  },
  [hotKeyRefs.SHOW_RECENT_REQUESTS.id]: {
    macKeys: [
      { ctrl: true, keyCode: keyboardKeys.tab.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.tab.keyCode },
    ],
  },
  [hotKeyRefs.SHOW_RECENT_REQUESTS_PREVIOUS.id]: {
    macKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.tab.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.tab.keyCode },
    ],
  },
  [hotKeyRefs.PLUGIN_RELOAD.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.r.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.r.keyCode },
    ],
  },
  [hotKeyRefs.SHOW_AUTOCOMPLETE.id]: {
    macKeys: [
      { ctrl: true, keyCode: keyboardKeys.space.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.space.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_SEND.id]: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.enter.keyCode },
      { meta: true, keyCode: keyboardKeys.r.keyCode },
      { keyCode: keyboardKeys.f5.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.enter.keyCode },
      { ctrl: true, keyCode: keyboardKeys.r.keyCode },
      { keyCode: keyboardKeys.f5.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_SHOW_OPTIONS.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.enter.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.enter.keyCode },
    ],
  },
  [hotKeyRefs.ENVIRONMENT_SHOW_EDITOR.id]: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.e.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.e.keyCode },
    ],
  },
  [hotKeyRefs.ENVIRONMENT_SHOW_SWITCH_MENU.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.e.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.e.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_TOGGLE_HTTP_METHOD_MENU.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.l.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.l.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_TOGGLE_HISTORY.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.h.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.h.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_FOCUS_URL.id]: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.l.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.l.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_SHOW_GENERATE_CODE_EDITOR.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.g.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.g.keyCode },
    ],
  },
  [hotKeyRefs.SIDEBAR_FOCUS_FILTER.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.f.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.f.keyCode },
    ],
  },
  [hotKeyRefs.SIDEBAR_TOGGLE.id]: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.backslash.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.backslash.keyCode },
    ],
  },
  [hotKeyRefs.RESPONSE_FOCUS.id]: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.singlequote.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.singlequote.keyCode },
    ],
  },
  [hotKeyRefs.SHOW_COOKIES_EDITOR.id]: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.k.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.k.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_SHOW_CREATE.id]: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.n.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.n.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_QUICK_CREATE.id]: {
    macKeys: [
      { alt: true, meta: true, keyCode: keyboardKeys.n.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, alt: true, keyCode: keyboardKeys.n.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_SHOW_DELETE.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.delete.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.delete.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_SHOW_CREATE_FOLDER.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.n.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.n.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_SHOW_DUPLICATE.id]: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.d.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.d.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_TOGGLE_PIN.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.p.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.p.keyCode },
    ],
  },
  [hotKeyRefs.CLOSE_DROPDOWN.id]: {
    macKeys: [
      { keyCode: keyboardKeys.esc.keyCode },
    ],
    winLinuxKeys: [
      { keyCode: keyboardKeys.esc.keyCode },
    ],
  },
  [hotKeyRefs.CLOSE_MODAL.id]: {
    macKeys: [
      { keyCode: keyboardKeys.esc.keyCode },
    ],
    winLinuxKeys: [
      { keyCode: keyboardKeys.esc.keyCode },
    ],
  },
  [hotKeyRefs.ENVIRONMENT_UNCOVER_VARIABLES.id]: {
    macKeys: [
      { alt: true, shift: true, keyCode: keyboardKeys.u.keyCode },
    ],
    winLinuxKeys: [
      { alt: true, shift: true, keyCode: keyboardKeys.u.keyCode },
    ],
  },
  [hotKeyRefs.SHOW_SPEC_EDITOR.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.s.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.s.keyCode },
    ],
  },
  [hotKeyRefs.SHOW_TEST.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.t.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.t.keyCode },
    ],
  },
  [hotKeyRefs.SHOW_MONITOR.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.m.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.m.keyCode },
    ],
  },
  [hotKeyRefs.SHOW_HOME.id]: {
    macKeys: [
      { shift: true, meta: true, keyCode: keyboardKeys.h.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, shift: true, keyCode: keyboardKeys.h.keyCode },
    ],
  },
  [hotKeyRefs.FILTER_DOCUMENTS.id]: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.f.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.f.keyCode },
    ],
  },
  [hotKeyRefs.TOGGLE_DEVTOOLS.id]: {
    macKeys: [
      { keyCode: keyboardKeys.f12.keyCode },
    ],
    winLinuxKeys: [
      { keyCode: keyboardKeys.f12.keyCode },
    ],
  },
};

const copyKeyCombs = (sources: KeyCombination[]) => sources.map(source => ({
  ...source,
}));

/**
 * Get a new copy of key bindings with default key combinations.
 */
export function newDefaultKeyBindings(hotKeyRefId: string): KeyBindings {
  const keyBindings = defaultRegistry[hotKeyRefId];
  return {
    macKeys: copyKeyCombs(keyBindings.macKeys),
    winLinuxKeys: copyKeyCombs(keyBindings.winLinuxKeys),
  };
}

/**
 * Get a new copy of hotkey registry with default values.
 */
export function newDefaultRegistry() {
  const newDefaults: HotKeyRegistry = {};

  for (const refId in defaultRegistry) {
    if (!defaultRegistry.hasOwnProperty(refId)) {
      continue;
    }

    newDefaults[refId] = newDefaultKeyBindings(refId);
  }

  return newDefaults;
}

/**
 * Get the key combinations based on the current platform.
 */
export function getPlatformKeyCombinations(bindings: KeyBindings) {
  console.log(JSON.parse(JSON.stringify({ bindings })));

  if (isMac()) {
    return bindings.macKeys;
  }

  return bindings.winLinuxKeys;
}

/**
 * Determine whether two key combinations are the same by comparing each of their keys.
 * @param keyComb1
 * @param keyComb2
 * @returns {boolean}
 */
export function areSameKeyCombinations(
  keyComb1: KeyCombination,
  keyComb2: KeyCombination,
) {
  return (
    keyComb1.alt === keyComb2.alt &&
    keyComb1.shift === keyComb2.shift &&
    keyComb1.ctrl === keyComb2.ctrl &&
    keyComb1.meta === keyComb2.meta &&
    keyComb1.keyCode === keyComb2.keyCode
  );
}

/**
 * Checks whether the given key bindings is the same as the default one,
 * identified with hot key reference id.
 * @param hotKeyRefId refers to the default key bindings to check.
 * @param keyBinds to check with the default ones.
 * @returns {boolean}
 */
export function areKeyBindingsSameAsDefault(hotKeyRefId: string, keyBinds: KeyBindings) {
  const keyCombs = getPlatformKeyCombinations(keyBinds);
  const defaultKeyCombs = getPlatformKeyCombinations(defaultRegistry[hotKeyRefId]);

  if (keyCombs.length !== defaultKeyCombs.length) {
    return false;
  }

  for (const keyComb of keyCombs) {
    const found = defaultKeyCombs.find(defKeyComb => {
      if (areSameKeyCombinations(keyComb, defKeyComb)) {
        return true;
      }
      return false;
    });

    if (found == null) {
      return false;
    }
  }

  return true;
}

/**
 * Gets the displayed text of a key code.
 * @param keyCode
 * @returns {string}
 */
export function getChar(keyCode: number) {
  let char;
  const key = Object.keys(keyboardKeys).find(k => keyboardKeys[k].keyCode === keyCode);

  if (!key) {
    console.error('Invalid key code', keyCode);
  } else {
    char = keyboardKeys[key].label;
  }

  return char || 'unknown';
}

function joinHotKeys(mustUsePlus: boolean, keys: string[]) {
  if (!mustUsePlus && isMac()) {
    return keys.join('');
  }

  return keys.join('+');
}

/**
 * Check whether key code is a modifier key, i.e., alt, shift, ctrl, or meta.
 * @param keyCode
 * @returns {boolean}
 */
export function isModifierKeyCode(keyCode: number) {
  return (
    keyCode === keyboardKeys.alt.keyCode ||
    keyCode === keyboardKeys.shift.keyCode ||
    keyCode === keyboardKeys.ctrl.keyCode || // Meta keys.
    keyCode === keyboardKeys.leftwindowkey.keyCode ||
    keyCode === keyboardKeys.rightwindowkey.keyCode ||
    keyCode === keyboardKeys.selectkey.keyCode
  );
}

/**
 * Construct the display string of a key combination based on platform.
 * For example, the display of alt in Windows or Linux would be "Alt";
 * while in Mac would be "⌥".
 * @param keyComb
 * @param mustUsePlus if true will join the characters with "+" for all platforms;
 * otherwise if the platform is Mac, the characters will be next to each other.
 * @returns the constructed string, if keyCode is null and the characters are joint with "+",
 * it will have a dangling "+" as the last character, e.g., "Alt+Ctrl+".
 */
export function constructKeyCombinationDisplay(
  keyComb: KeyCombination,
  mustUsePlus: boolean,
) {
  const { ctrl, alt, shift, meta, keyCode } = keyComb;
  const chars: string[] = [];
  alt && chars.push(ALT_SYM);
  shift && chars.push(SHIFT_SYM);
  ctrl && chars.push(CTRL_SYM);
  meta && chars.push(META_SYM);

  if (keyCode != null && !isModifierKeyCode(keyCode)) {
    chars.push(getChar(keyCode));
  }

  let joint = joinHotKeys(mustUsePlus, chars);

  if (mustUsePlus && isModifierKeyCode(keyCode)) {
    joint += '+';
  }

  return joint;
}

/**
 * Construct the display string for a key combination
 * @returns key combination as string or empty string if not found
 */
export function getHotKeyDisplay(
  hotKeyDef: HotKeyDefinition,
  hotKeyRegistry: HotKeyRegistry,
  mustUsePlus: boolean,
) {
  const hotKey = hotKeyRegistry[hotKeyDef.id];

  if (!hotKey) {
    return '';
  }

  const keyCombs = getPlatformKeyCombinations(hotKey);
  if (keyCombs.length === 0) {
    return '';
  }

  return constructKeyCombinationDisplay(keyCombs[0], mustUsePlus);
}
