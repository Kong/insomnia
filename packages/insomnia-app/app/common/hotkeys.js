// @flow
import keycodes from './keycodes';
import { isMac, isWindows } from './constants';

export type HotKeyDefinition = {
  id: string,
  description: string,
};

export type KeyCombination = {
  ctrl: boolean,
  alt: boolean,
  shift: boolean,
  meta: boolean,
  keyCode: number,
};

type GenericKeyCombination = {
  ctrlOrCmd: boolean,
  alt: boolean,
  shift: boolean,
  winOrCtrl: boolean,
  keyCode: number,
};

export type KeyBindings = {
  macKeys: Array<KeyCombination>,
  winKeys: Array<KeyCombination>,
  linuxKeys: Array<KeyCombination>,
};

export type HotKeyRegistry = {
  [refId: string]: KeyBindings,
};

function defineHotKey(id: string, description: string): HotKeyDefinition {
  return {
    id: id,
    description: description,
  };
}

function keyComb(
  ctrl: boolean,
  alt: boolean,
  shift: boolean,
  meta: boolean,
  keyCode: number,
): KeyCombination {
  return {
    ctrl: ctrl,
    alt: alt,
    shift: shift,
    meta: meta,
    keyCode: keyCode,
  };
}

function genericKeyComb(
  ctrlOrCmd: boolean,
  alt: boolean,
  shift: boolean,
  winOrCtrl: boolean,
  keyCode: number,
): GenericKeyCombination {
  return {
    ctrlOrCmd: ctrlOrCmd,
    alt: alt,
    shift: shift,
    winOrCtrl: winOrCtrl,
    keyCode: keyCode,
  };
}

function toSpecificKeyCombs(
  isMac: boolean,
  generic: Array<GenericKeyCombination>,
): Array<KeyCombination> {
  let keyCombs: Array<KeyCombination> = [];

  generic.forEach(genKeyComb => {
    let keyComb: KeyCombination;
    if (isMac) {
      keyComb = {
        ctrl: genKeyComb.winOrCtrl,
        alt: genKeyComb.alt,
        shift: genKeyComb.shift,
        meta: genKeyComb.ctrlOrCmd,
        keyCode: genKeyComb.keyCode,
      };
    } else {
      keyComb = {
        ctrl: genKeyComb.ctrlOrCmd,
        alt: genKeyComb.alt,
        shift: genKeyComb.shift,
        meta: genKeyComb.winOrCtrl,
        keyCode: genKeyComb.keyCode,
      };
    }
    keyCombs.push(keyComb);
  });

  return keyCombs;
}

function keyBinds(
  generic: GenericKeyCombination | Array<GenericKeyCombination>,
  mac?: KeyCombination | Array<KeyCombination>,
  win?: KeyCombination | Array<KeyCombination>,
  linux?: KeyCombination | Array<KeyCombination>,
): KeyBindings {
  if (!Array.isArray(generic)) {
    generic = [generic];
  }

  if (mac == null) {
    mac = toSpecificKeyCombs(true, generic);
  } else if (!Array.isArray(mac)) {
    mac = [mac];
  }

  if (win == null) {
    win = toSpecificKeyCombs(false, generic);
  } else if (!Array.isArray(win)) {
    win = [win];
  }

  if (linux == null) {
    linux = toSpecificKeyCombs(false, generic);
  } else if (!Array.isArray(linux)) {
    linux = [linux];
  }

  return {
    macKeys: mac,
    winKeys: win,
    linuxKeys: linux,
  };
}

// Not using dot, because NeDB prohibits field names to contain dots.
export const hotKeyRefs = {
  WORKSPACE_SHOW_SETTINGS: defineHotKey('workspace_showSettings', 'Show Workspace Settings'),

  REQUEST_SHOW_SETTINGS: defineHotKey('request_showSettings', 'Show Request Settings'),

  PREFERENCES_SHOW_KEYBOARD_SHORTCUTS: defineHotKey(
    'preferences_showKeyboardShortcuts',
    'Show Keyboard Shortcuts',
  ),

  PREFERENCES_SHOW_GENERAL: defineHotKey('preferences_showGeneral', 'Show App Preferences'),

  TOGGLE_MAIN_MENU: defineHotKey('toggleMainMenu', 'Toggle Main Menu'),

  SIDEBAR_TOGGLE: defineHotKey('sidebar_toggle', 'Toggle Sidebar'),

  REQUEST_QUICK_SWITCH: defineHotKey('request_quickSwitch', 'Switch Requests'),

  PLUGIN_RELOAD: defineHotKey('plugin_reload', 'Reload Plugins'),

  SHOW_AUTOCOMPLETE: defineHotKey('showAutocomplete', 'Show Autocomplete'),

  REQUEST_SEND: defineHotKey('request_send', 'Send Request'),

  REQUEST_SHOW_OPTIONS: defineHotKey('request_showOptions', 'Send Request (Options)'),

  ENVIRONMENT_SHOW_EDITOR: defineHotKey('environment_showEditor', 'Show Environment Editor'),

  ENVIRONMENT_SHOW_SWITCH_MENU: defineHotKey('environment_showSwitchMenu', 'Switch Environments'),

  REQUEST_TOGGLE_HTTP_METHOD_MENU: defineHotKey(
    'request_toggleHttpMethodMenu',
    'Change HTTP Method',
  ),

  REQUEST_TOGGLE_HISTORY: defineHotKey('request_toggleHistory', 'Show Request History'),

  REQUEST_FOCUS_URL: defineHotKey('request_focusUrl', 'Focus URL'),

  REQUEST_SHOW_GENERATE_CODE_EDITOR: defineHotKey(
    'request_showGenerateCodeEditor',
    'Generate Code',
  ),

  SIDEBAR_FOCUS_FILTER: defineHotKey('sidebar_focusFilter', 'Filter Sidebar'),

  RESPONSE_FOCUS: defineHotKey('response_focus', 'Focus Response'),

  SHOW_COOKIES_EDITOR: defineHotKey('showCookiesEditor', 'Edit Cookies'),

  REQUEST_SHOW_CREATE: defineHotKey('request_showCreate', 'Create Request'),

  REQUEST_SHOW_DELETE: defineHotKey('request_showDelete', 'Delete Request'),

  REQUEST_SHOW_CREATE_FOLDER: defineHotKey('request_showCreateFolder', 'Create Folder'),

  REQUEST_SHOW_DUPLICATE: defineHotKey('request_showDuplicate', 'Duplicate Request'),

  CLOSE_DROPDOWN: defineHotKey('closeDropdown', 'Close Dropdown'),

  CLOSE_MODAL: defineHotKey('closeModal', 'Close Modal'),

  ENVIRONMENT_UNCOVER_VARIABLES: defineHotKey('environment_uncoverVariables', 'Uncover Variables'),
};

const defaultRegistry: HotKeyRegistry = {
  [hotKeyRefs.WORKSPACE_SHOW_SETTINGS.id]: keyBinds(
    genericKeyComb(true, false, true, false, keycodes.comma),
  ),

  [hotKeyRefs.REQUEST_SHOW_SETTINGS.id]: keyBinds(
    genericKeyComb(true, true, true, false, keycodes.comma),
  ),

  [hotKeyRefs.PREFERENCES_SHOW_KEYBOARD_SHORTCUTS.id]: keyBinds(
    genericKeyComb(true, false, true, false, keycodes.forwardslash),
  ),

  [hotKeyRefs.PREFERENCES_SHOW_GENERAL.id]: keyBinds(
    genericKeyComb(true, false, false, false, keycodes.comma),
  ),

  [hotKeyRefs.TOGGLE_MAIN_MENU.id]: keyBinds(
    genericKeyComb(true, true, false, false, keycodes.comma),
  ),

  [hotKeyRefs.SIDEBAR_TOGGLE.id]: keyBinds(
    genericKeyComb(true, false, false, false, keycodes.backslash),
  ),

  [hotKeyRefs.REQUEST_QUICK_SWITCH.id]: keyBinds(
    genericKeyComb(true, false, false, false, keycodes.p),
  ),

  [hotKeyRefs.PLUGIN_RELOAD.id]: keyBinds(genericKeyComb(true, false, true, false, keycodes.r)),

  [hotKeyRefs.SHOW_AUTOCOMPLETE.id]: keyBinds(
    genericKeyComb(true, false, false, false, keycodes.space),
    keyComb(true, false, false, false, keycodes.space),
  ),

  [hotKeyRefs.REQUEST_SEND.id]: keyBinds([
    genericKeyComb(true, false, false, false, keycodes.enter),
    genericKeyComb(true, false, false, false, keycodes.r),
    genericKeyComb(false, false, false, false, keycodes.f5),
  ]),

  [hotKeyRefs.REQUEST_SHOW_OPTIONS.id]: keyBinds(
    genericKeyComb(true, false, true, false, keycodes.enter),
  ),

  [hotKeyRefs.ENVIRONMENT_SHOW_EDITOR.id]: keyBinds(
    genericKeyComb(true, false, false, false, keycodes.e),
  ),

  [hotKeyRefs.ENVIRONMENT_SHOW_SWITCH_MENU.id]: keyBinds(
    genericKeyComb(true, false, true, false, keycodes.e),
  ),

  [hotKeyRefs.REQUEST_TOGGLE_HTTP_METHOD_MENU.id]: keyBinds(
    genericKeyComb(true, false, true, false, keycodes.l),
  ),

  [hotKeyRefs.REQUEST_TOGGLE_HISTORY.id]: keyBinds(
    genericKeyComb(true, false, true, false, keycodes.h),
  ),

  [hotKeyRefs.REQUEST_FOCUS_URL.id]: keyBinds(
    genericKeyComb(true, false, false, false, keycodes.l),
  ),

  [hotKeyRefs.REQUEST_SHOW_GENERATE_CODE_EDITOR.id]: keyBinds(
    genericKeyComb(true, false, true, false, keycodes.g),
  ),

  [hotKeyRefs.SIDEBAR_FOCUS_FILTER.id]: keyBinds(
    genericKeyComb(true, false, true, false, keycodes.f),
  ),

  [hotKeyRefs.RESPONSE_FOCUS.id]: keyBinds(
    genericKeyComb(true, false, false, false, keycodes.singlequote),
  ),

  [hotKeyRefs.SHOW_COOKIES_EDITOR.id]: keyBinds(
    genericKeyComb(true, false, false, false, keycodes.k),
  ),

  [hotKeyRefs.REQUEST_SHOW_CREATE.id]: keyBinds(
    genericKeyComb(true, false, false, false, keycodes.n),
  ),

  [hotKeyRefs.REQUEST_SHOW_DELETE.id]: keyBinds(
    genericKeyComb(true, false, true, false, keycodes.delete),
  ),

  [hotKeyRefs.REQUEST_SHOW_CREATE_FOLDER.id]: keyBinds(
    genericKeyComb(true, false, true, false, keycodes.n),
  ),

  [hotKeyRefs.REQUEST_SHOW_DUPLICATE.id]: keyBinds(
    genericKeyComb(true, false, false, false, keycodes.d),
  ),

  [hotKeyRefs.CLOSE_DROPDOWN.id]: keyBinds(
    genericKeyComb(false, false, false, false, keycodes.esc),
  ),

  [hotKeyRefs.CLOSE_MODAL.id]: keyBinds(genericKeyComb(false, false, false, false, keycodes.esc)),

  [hotKeyRefs.ENVIRONMENT_UNCOVER_VARIABLES.id]: keyBinds(
    genericKeyComb(false, true, true, false, keycodes.u),
  ),
};

function copyKeyCombs(sources: Array<KeyCombination>): Array<KeyCombination> {
  let targets: Array<KeyCombination> = [];
  sources.forEach(keyComb => {
    targets.push(Object.assign({}, keyComb));
  });
  return targets;
}

export function newDefaultRegistry() {
  let newDefaults: HotKeyRegistry = {};
  for (const refId in defaultRegistry) {
    if (!defaultRegistry.hasOwnProperty(refId)) {
      continue;
    }
    const keyBindings: KeyBindings = defaultRegistry[refId];
    newDefaults[refId] = {
      macKeys: copyKeyCombs(keyBindings.macKeys),
      winKeys: copyKeyCombs(keyBindings.winKeys),
      linuxKeys: copyKeyCombs(keyBindings.linuxKeys),
    };
  }
  return newDefaults;
}

export function getPlatformKeyCombinations(bindings: KeyBindings): Array<KeyCombination> {
  if (isMac()) {
    return bindings.macKeys;
  }
  if (isWindows()) {
    return bindings.winKeys;
  }
  return bindings.linuxKeys;
}

export function getChar(keyCode: number) {
  let char;
  const keyCodeStr = Object.keys(keycodes).find(k => keycodes[k] === keyCode);

  if (!keyCodeStr) {
    console.error('Invalid key code', keyCode);
  } else {
    const cap = keyCodeStr.toUpperCase();
    if (cap === 'ENTER') {
      char = 'Enter';
    } else if (cap === 'DELETE') {
      char = 'Delete';
    } else if (cap === 'COMMA') {
      char = ',';
    } else if (cap === 'BACKSLASH') {
      char = '\\';
    } else if (cap === 'FORWARDSLASH') {
      char = '/';
    } else if (cap === 'SINGLEQUOTE') {
      char = "'";
    } else if (cap === 'SPACE') {
      char = 'Space';
    } else {
      char = cap;
    }
  }

  return char || 'unknown';
}
