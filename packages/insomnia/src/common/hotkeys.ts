import { HotKeyRegistry, KeyBindings, KeyCombination } from 'insomnia-common';
import { forEach } from 'ramda';

import { displayModifierKey, isMac } from './constants';
import { keyboardKeys } from './keyboard-keys';
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
 * The collection of available hotkeys' and their definitions.
 */
// Not using dot, because NeDB prohibits field names to contain dots.
export const hotKeyRefs: Record<string, HotKeyDefinition> = {
  WORKSPACE_SHOW_SETTINGS: {
    id: 'workspace_showSettings',
    description: `Show ${strings.document.singular} / ${strings.collection.singular} Settings`,
  },
  REQUEST_SHOW_SETTINGS: {
    id: 'request_showSettings',
    description: 'Show Request Settings',
  },
  PREFERENCES_SHOW_KEYBOARD_SHORTCUTS: {
    id: 'preferences_showKeyboardShortcuts',
    description: 'Show Keyboard Shortcuts',
  },
  PREFERENCES_SHOW_GENERAL: {
    id: 'preferences_showGeneral',
    description: 'Show App Preferences',
  },
  REQUEST_QUICK_SWITCH: {
    id: 'request_quickSwitch',
    description: 'Switch Requests',
  },
  SHOW_RECENT_REQUESTS: {
    id: 'request_showRecent',
    description: 'Show Recent Requests',
  },
  SHOW_RECENT_REQUESTS_PREVIOUS: {
    id: 'request_showRecentPrevious',
    description: 'Show Recent Requests (Previous)',
  },
  PLUGIN_RELOAD: {
    id: 'plugin_reload',
    description: 'Reload Plugins',
  },
  SHOW_AUTOCOMPLETE: {
    id: 'showAutocomplete',
    description: 'Show Autocomplete',
  },
  REQUEST_SEND: {
    id: 'request_send',
    description: 'Send Request',
  },
  REQUEST_SHOW_OPTIONS: {
    id: 'request_showOptions',
    description: 'Send Request (Options)',
  },
  ENVIRONMENT_SHOW_EDITOR: {
    id: 'environment_showEditor',
    description: 'Show Environment Editor',
  },
  ENVIRONMENT_SHOW_SWITCH_MENU: {
    id: 'environment_showSwitchMenu',
    description: 'Switch Environments',
  },
  REQUEST_TOGGLE_HTTP_METHOD_MENU: {
    id: 'request_toggleHttpMethodMenu',
    description: 'Change HTTP Method',
  },
  REQUEST_TOGGLE_HISTORY: {
    id: 'request_toggleHistory',
    description: 'Show Request History',
  },
  REQUEST_FOCUS_URL: {
    id: 'request_focusUrl',
    description: 'Focus URL',
  },
  REQUEST_SHOW_GENERATE_CODE_EDITOR: {
    id: 'request_showGenerateCodeEditor',
    description: 'Generate Code',
  },
  SIDEBAR_FOCUS_FILTER: {
    id: 'sidebar_focusFilter',
    description: 'Filter Sidebar',
  },
  SIDEBAR_TOGGLE: {
    id: 'sidebar_toggle',
    description: 'Toggle Sidebar',
  },
  RESPONSE_FOCUS: {
    id: 'response_focus',
    description: 'Focus Response',
  },
  SHOW_COOKIES_EDITOR: {
    id: 'showCookiesEditor',
    description: 'Edit Cookies',
  },
  REQUEST_CREATE_HTTP: {
    id: 'request_createHTTP',
    description: 'Create HTTP Request',
  },
  REQUEST_SHOW_DELETE: {
    id: 'request_showDelete',
    description: 'Delete Request',
  },
  REQUEST_SHOW_CREATE_FOLDER: {
    id: 'request_showCreateFolder',
    description: 'Create Folder',
  },
  REQUEST_SHOW_DUPLICATE: {
    id: 'request_showDuplicate',
    description: 'Duplicate Request',
  },
  REQUEST_TOGGLE_PIN: {
    id: 'request_togglePin',
    description: 'Pin/Unpin Request',
  },
  CLOSE_DROPDOWN: {
    id: 'closeDropdown',
    description: 'Close Dropdown',
  },
  CLOSE_MODAL: {
    id: 'closeModal',
    description: 'Close Modal',
  },
  ENVIRONMENT_SHOW_VARIABLE_SOURCE_AND_VALUE: {
    id: 'environment_showVariableSourceAndValue',
    description: 'Show variable source and value',
  },
  BEAUTIFY_REQUEST_BODY: {
    id: 'beautifyRequestBody',
    description: 'Beautify Active Code Editors',
  },
  GRAPHQL_EXPLORER_FOCUS_FILTER: {
    id: 'graphql_explorer_focus_filter',
    description: 'Focus GraphQL Explorer Filter',
  },
  FILTER_DOCUMENTS: {
    id: 'documents_filter',
    description: 'Focus Documents Filter',
  },
};

/**
 * The default key bindings values of all available hotkeys.
 */
const defaultRegistry: HotKeyRegistry = {
  [hotKeyRefs.WORKSPACE_SHOW_SETTINGS.id]: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.comma.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.comma.keyCode }],
  },
  [hotKeyRefs.REQUEST_SHOW_SETTINGS.id]: {
    macKeys: [{ alt: true, shift: true, meta: true, keyCode: keyboardKeys.comma.keyCode }],
    winLinuxKeys: [{ ctrl: true, alt: true, shift: true, keyCode: keyboardKeys.comma.keyCode }],
  },
  [hotKeyRefs.PREFERENCES_SHOW_KEYBOARD_SHORTCUTS.id]: {
    macKeys: [{ ctrl: true, shift: true, meta: true, keyCode: keyboardKeys.forwardslash.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.forwardslash.keyCode }],
  },
  [hotKeyRefs.PREFERENCES_SHOW_GENERAL.id]: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.comma.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.comma.keyCode }],
  },
  [hotKeyRefs.REQUEST_QUICK_SWITCH.id]: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.p.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.p.keyCode }],
  },
  [hotKeyRefs.SHOW_RECENT_REQUESTS.id]: {
    macKeys: [{ ctrl: true, keyCode: keyboardKeys.tab.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.tab.keyCode }],
  },
  [hotKeyRefs.SHOW_RECENT_REQUESTS_PREVIOUS.id]: {
    macKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.tab.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.tab.keyCode }],
  },
  [hotKeyRefs.PLUGIN_RELOAD.id]: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.r.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.r.keyCode }],
  },
  [hotKeyRefs.SHOW_AUTOCOMPLETE.id]: {
    macKeys: [{ ctrl: true, keyCode: keyboardKeys.space.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.space.keyCode }],
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
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.enter.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.enter.keyCode }],
  },
  [hotKeyRefs.ENVIRONMENT_SHOW_EDITOR.id]: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.e.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.e.keyCode }],
  },
  [hotKeyRefs.ENVIRONMENT_SHOW_SWITCH_MENU.id]: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.e.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.e.keyCode }],
  },
  [hotKeyRefs.REQUEST_TOGGLE_HTTP_METHOD_MENU.id]: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.l.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.l.keyCode }],
  },
  [hotKeyRefs.REQUEST_TOGGLE_HISTORY.id]: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.h.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.h.keyCode }],
  },
  [hotKeyRefs.REQUEST_FOCUS_URL.id]: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.l.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.l.keyCode }],
  },
  [hotKeyRefs.REQUEST_SHOW_GENERATE_CODE_EDITOR.id]: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.g.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.g.keyCode }],
  },
  [hotKeyRefs.SIDEBAR_FOCUS_FILTER.id]: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.f.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.f.keyCode }],
  },
  [hotKeyRefs.SIDEBAR_TOGGLE.id]: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.backslash.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.backslash.keyCode }],
  },
  [hotKeyRefs.RESPONSE_FOCUS.id]: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.singlequote.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.singlequote.keyCode }],
  },
  [hotKeyRefs.SHOW_COOKIES_EDITOR.id]: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.k.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.k.keyCode }],
  },
  [hotKeyRefs.REQUEST_CREATE_HTTP.id]: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.n.keyCode },
      { alt: true, meta: true, keyCode: keyboardKeys.n.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.n.keyCode },
      { ctrl: true, alt: true, keyCode: keyboardKeys.n.keyCode },
    ],
  },
  [hotKeyRefs.REQUEST_SHOW_DELETE.id]: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.delete.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.delete.keyCode }],
  },
  [hotKeyRefs.REQUEST_SHOW_CREATE_FOLDER.id]: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.n.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.n.keyCode }],
  },
  [hotKeyRefs.REQUEST_SHOW_DUPLICATE.id]: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.d.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.d.keyCode }],
  },
  [hotKeyRefs.REQUEST_TOGGLE_PIN.id]: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.p.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.p.keyCode }],
  },
  [hotKeyRefs.CLOSE_DROPDOWN.id]: {
    macKeys: [{ keyCode: keyboardKeys.esc.keyCode }],
    winLinuxKeys: [{ keyCode: keyboardKeys.esc.keyCode }],
  },
  [hotKeyRefs.CLOSE_MODAL.id]: {
    macKeys: [{ keyCode: keyboardKeys.esc.keyCode }],
    winLinuxKeys: [{ keyCode: keyboardKeys.esc.keyCode }],
  },
  [hotKeyRefs.ENVIRONMENT_SHOW_VARIABLE_SOURCE_AND_VALUE.id]: {
    macKeys: [{ alt: true, shift: true, keyCode: keyboardKeys.u.keyCode }],
    winLinuxKeys: [{ alt: true, shift: true, keyCode: keyboardKeys.u.keyCode }],
  },
  [hotKeyRefs.GRAPHQL_EXPLORER_FOCUS_FILTER.id]: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.f.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.f.keyCode }],
  },
  [hotKeyRefs.BEAUTIFY_REQUEST_BODY.id]: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.i.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.i.keyCode }],
  },
  [hotKeyRefs.FILTER_DOCUMENTS.id]: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.f.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.f.keyCode }],
  },
};

function copyKeyCombs(sources: KeyCombination[]): KeyCombination[] {
  const targets: KeyCombination[] = [];
  sources.forEach(keyComb => {
    targets.push(Object.assign({}, keyComb));
  });
  return targets;
}

/**
 * Get a new copy of key bindings with default key combinations.
 * @param hotKeyRefId
 * @returns {KeyBindings}
 */
export function newDefaultKeyBindings(hotKeyRefId: string): KeyBindings {
  const keyBindings: KeyBindings = defaultRegistry[hotKeyRefId];
  return {
    macKeys: copyKeyCombs(keyBindings.macKeys),
    winLinuxKeys: copyKeyCombs(keyBindings.winLinuxKeys),
  };
}

/**
 * Get a new copy of hotkey registry with default values.
 * @returns {HotKeyRegistry}
 */
export function newDefaultRegistry(): HotKeyRegistry {
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
 * @param bindings
 * @returns {Array<KeyCombination>}
 */
export function getPlatformKeyCombinations(bindings: KeyBindings): KeyCombination[] {
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
    keyComb1.keyCode === keyComb2.keyCode &&
    Boolean(keyComb1.alt) === Boolean(keyComb2.alt) &&
    Boolean(keyComb1.shift) === Boolean(keyComb2.shift) &&
    Boolean(keyComb1.ctrl) === Boolean(keyComb2.ctrl) &&
    Boolean(keyComb1.meta) === Boolean(keyComb2.meta)
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
    return keys.join(' ');
  }

  return keys.join(' + ');
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
    keyCode === keyboardKeys.ctrl.keyCode ||

    // Meta keys.
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
 * @param mustUsePlus if true will join the characters with " + " for all platforms;
 * otherwise if the platform is Mac, the characters will be next to each other.
 * @returns the constructed string, if keyCode is null and the characters are joined with " + ",
 * it will have a dangling "+" as the last character, e.g., "Alt + Ctrl +".
 */
export function constructKeyCombinationDisplay(
  keyComb: KeyCombination,
  mustUsePlus: boolean,
) {
  const { keyCode } = keyComb;
  const chars: string[] = [];

  const addModifierKeys = (keys: (keyof Omit<KeyCombination, 'keyCode'>)[]) => {
    forEach(key => {
      if (keyComb[key]) {
        chars.push(displayModifierKey(key));
      }
    }, keys);
  };

  if (isMac()) {
    // Note: on Mac the cannonical order is Control, Option (i.e. Alt), Shift, Command (i.e. Meta)
    // see: https://developer.apple.com/design/human-interface-guidelines/macos/user-interaction/keyboard
    addModifierKeys(['ctrl', 'alt', 'shift', 'meta']);
  } else {
    // Note: on Windows the observed oreder (as in, if you just try to make a shortcut with all modifiers) is Windows (i.e. Super/Meta), Ctrl, Alt, Shift.
    // No such standard really exists, but at least on Ubunut it follows the Windows ordering.
    addModifierKeys(['meta', 'ctrl', 'alt', 'shift']);
  }

  if (keyCode != null && !isModifierKeyCode(keyCode)) {
    chars.push(getChar(keyCode));
  }

  let joint = joinHotKeys(mustUsePlus, chars);

  if (mustUsePlus && isModifierKeyCode(keyCode)) {
    joint += ' +';
  }

  return joint;
}

/**
 * Construct the display string for a key combination
 *
 * @param hotKeyDef
 * @param hotKeyRegistry
 * @param mustUsePlus
 * @returns {string} – key combination as string or empty string if not found
 */
export function getHotKeyDisplay(
  hotKeyDef: HotKeyDefinition,
  hotKeyRegistry: HotKeyRegistry,
  mustUsePlus: boolean,
) {
  const hotKey: KeyBindings | null | undefined = hotKeyRegistry[hotKeyDef.id];

  if (!hotKey) {
    return '';
  }

  const keyCombs: KeyCombination[] = getPlatformKeyCombinations(hotKey);

  if (keyCombs.length === 0) {
    return '';
  }

  return constructKeyCombinationDisplay(keyCombs[0], mustUsePlus);
}
