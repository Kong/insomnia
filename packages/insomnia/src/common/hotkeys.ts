import { displayModifierKey, isMac } from './constants';
import { keyboardKeys } from './keyboard-keys';
import { HotKeyRegistry, KeyboardShortcut, KeyCombination, PlatformKeyCombinations } from './settings';
import { strings } from './strings';

/**
 * The collection of available hotkeys' and their descriptions.
 * @IMPORTANT Not using dot, because NeDB prohibits field names to contain dots.
 */
export const keyboardShortcutDescriptions: Record<KeyboardShortcut, string> = {
  'workspace_showSettings': `Show ${strings.document.singular} / ${strings.collection.singular} Settings`,
  'request_showSettings': 'Show Request Settings',
  'preferences_showKeyboardShortcuts': 'Show Keyboard Shortcuts',
  'preferences_showGeneral': 'Show App Preferences',
  'request_quickSwitch': 'Switch Requests',
  'request_showRecent': 'Show Recent Requests',
  'request_showRecentPrevious': 'Show Recent Requests (Previous)',
  'plugin_reload': 'Reload Plugins',
  'showAutocomplete': 'Show Autocomplete',
  'request_send': 'Send Request',
  'request_showOptions': 'Send Request (Options)',
  'environment_showEditor': 'Show Environment Editor',
  'environment_showSwitchMenu': 'Switch Environments',
  'request_toggleHttpMethodMenu': 'Change HTTP Method',
  'request_toggleHistory': 'Show Request History',
  'request_focusUrl': 'Focus URL',
  'request_showGenerateCodeEditor': 'Generate Code',
  'sidebar_focusFilter': 'Filter Sidebar',
  'sidebar_toggle': 'Toggle Sidebar',
  'response_focus': 'Focus Response',
  'showCookiesEditor': 'Edit Cookies',
  'request_createHTTP': 'Create HTTP Request',
  'request_showDelete': 'Delete Request',
  'request_showCreateFolder': 'Create Folder',
  'request_showDuplicate': 'Duplicate Request',
  'request_togglePin': 'Pin/Unpin Request',
  'environment_showVariableSourceAndValue': 'Show variable source and value',
  'beautifyRequestBody': 'Beautify Active Code Editors',
  'graphql_explorer_focus_filter': 'Focus GraphQL Explorer Filter',
};

/**
 * The default key bindings values of all available hotkeys.
 */
const defaultRegistry: HotKeyRegistry = {
  workspace_showSettings: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.comma.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.comma.keyCode }],
  },
  request_showSettings: {
    macKeys: [{ alt: true, shift: true, meta: true, keyCode: keyboardKeys.comma.keyCode }],
    winLinuxKeys: [{ ctrl: true, alt: true, shift: true, keyCode: keyboardKeys.comma.keyCode }],
  },
  preferences_showKeyboardShortcuts: {
    macKeys: [{ ctrl: true, shift: true, meta: true, keyCode: keyboardKeys.forwardslash.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.forwardslash.keyCode }],
  },
  preferences_showGeneral: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.comma.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.comma.keyCode }],
  },
  request_quickSwitch: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.p.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.p.keyCode }],
  },
  request_showRecent: {
    macKeys: [{ ctrl: true, keyCode: keyboardKeys.tab.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.tab.keyCode }],
  },
  request_showRecentPrevious: {
    macKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.tab.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.tab.keyCode }],
  },
  plugin_reload: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.r.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.r.keyCode }],
  },
  showAutocomplete: {
    macKeys: [{ ctrl: true, keyCode: keyboardKeys.space.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.space.keyCode }],
  },
  request_send: {
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
  request_showOptions: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.enter.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.enter.keyCode }],
  },
  environment_showEditor: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.e.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.e.keyCode }],
  },
  environment_showSwitchMenu: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.e.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.e.keyCode }],
  },
  request_toggleHttpMethodMenu: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.l.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.l.keyCode }],
  },
  request_toggleHistory: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.h.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.h.keyCode }],
  },
  request_focusUrl: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.l.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.l.keyCode }],
  },
  request_showGenerateCodeEditor: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.g.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.g.keyCode }],
  },
  sidebar_focusFilter: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.f.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.f.keyCode }],
  },
  sidebar_toggle: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.backslash.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.backslash.keyCode }],
  },
  response_focus: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.singlequote.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.singlequote.keyCode }],
  },
  showCookiesEditor: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.k.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.k.keyCode }],
  },
  request_createHTTP: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.n.keyCode },
      { alt: true, meta: true, keyCode: keyboardKeys.n.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.n.keyCode },
      { ctrl: true, alt: true, keyCode: keyboardKeys.n.keyCode },
    ],
  },
  request_showDelete: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.delete.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.delete.keyCode }],
  },
  request_showCreateFolder: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.n.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.n.keyCode }],
  },
  request_showDuplicate: {
    macKeys: [{ meta: true, keyCode: keyboardKeys.d.keyCode }],
    winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.d.keyCode }],
  },
  request_togglePin: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.p.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.p.keyCode }],
  },
  environment_showVariableSourceAndValue: {
    macKeys: [{ alt: true, shift: true, keyCode: keyboardKeys.u.keyCode }],
    winLinuxKeys: [{ alt: true, shift: true, keyCode: keyboardKeys.u.keyCode }],
  },
  beautifyRequestBody: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.f.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.f.keyCode }],
  },
  graphql_explorer_focus_filter: {
    macKeys: [{ shift: true, meta: true, keyCode: keyboardKeys.i.keyCode }],
    winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.i.keyCode }],
  },
};

/**
 * Get a new copy of hotkey registry with default values.
 */
export function newDefaultRegistry(): HotKeyRegistry {
  return JSON.parse(JSON.stringify(defaultRegistry));
}

/**
 * Get the key combinations based on the current platform.
 */
export function getPlatformKeyCombinations(bindings: PlatformKeyCombinations): KeyCombination[] {
  if (isMac()) {
    return bindings.macKeys;
  }

  return bindings.winLinuxKeys;
}

/**
 * Determine whether two key combinations are the same by comparing each of their keys.
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
 * Gets the displayed text of a key code.
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
 */
export function isModifierKeyCode(keyCode: number): boolean {
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
    keys.forEach(key => {
      if (keyComb[key]) {
        chars.push(displayModifierKey(key));
      }
    });
  };

  if (isMac()) {
    // Note: on Mac the canonical order is Control, Option (i.e. Alt), Shift, Command (i.e. Meta)
    // see: https://developer.apple.com/design/human-interface-guidelines/macos/user-interaction/keyboard
    addModifierKeys(['ctrl', 'alt', 'shift', 'meta']);
  } else {
    // Note: on Windows the observed oreder (as in, if you just try to make a shortcut with all modifiers) is Windows (i.e. Super/Meta), Ctrl, Alt, Shift.
    // No such standard really exists, but at least on Ubuntu it follows the Windows ordering.
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
