// @flow
import keycodes from './keycodes';
import { isMac } from './constants';

export type Hotkey = {
  description: string,
  meta: boolean,
  alt: boolean,
  shift: boolean,
  keycode: number | Array<number>,
  metaIsCtrl?: boolean
};

export const SHOW_WORKSPACE_SETTINGS: Hotkey = {
  description: 'Show Workspace Settings',
  meta: true,
  alt: false,
  shift: true,
  keycode: keycodes.comma
};

export const SHOW_REQUEST_SETTINGS: Hotkey = {
  description: 'Show Request Settings',
  meta: true,
  alt: true,
  shift: true,
  keycode: keycodes.comma
};

export const SHOW_SETTINGS: Hotkey = {
  description: 'Show App Preferences',
  meta: true,
  alt: false,
  shift: false,
  keycode: keycodes.comma
};

export const TOGGLE_MAIN_MENU: Hotkey = {
  description: 'Toggle Main Menu',
  meta: true,
  alt: true,
  shift: false,
  keycode: keycodes.comma
};

export const TOGGLE_SIDEBAR: Hotkey = {
  description: 'Toggle Sidebar',
  meta: true,
  alt: false,
  shift: false,
  keycode: keycodes.backslash
};

export const SHOW_QUICK_SWITCHER: Hotkey = {
  description: 'Switch Requests',
  meta: true,
  alt: false,
  shift: false,
  keycode: keycodes.p
};

export const RELOAD_PLUGINS: Hotkey = {
  description: 'Reload Plugins',
  meta: true,
  alt: false,
  shift: true,
  keycode: keycodes.r
};

export const SHOW_AUTOCOMPLETE: Hotkey = {
  description: 'Show Autocomplete',
  meta: true,
  metaIsCtrl: true,
  alt: false,
  shift: false,
  keycode: keycodes.space
};

export const SEND_REQUEST: Hotkey = {
  description: 'Send Request',
  meta: true,
  alt: false,
  shift: false,
  keycode: [keycodes.enter, keycodes.r]
};

export const SEND_REQUEST_F5: Hotkey = {
  description: 'Send Request',
  meta: false,
  alt: false,
  shift: false,
  keycode: keycodes.f5
};

export const SHOW_SEND_OPTIONS: Hotkey = {
  description: 'Send Request (Options)',
  meta: true,
  alt: false,
  shift: true,
  keycode: keycodes.enter
};

export const SHOW_ENVIRONMENTS: Hotkey = {
  description: 'Show Environment Editor',
  meta: true,
  alt: false,
  shift: false,
  keycode: keycodes.e
};

export const TOGGLE_ENVIRONMENTS_MENU: Hotkey = {
  description: 'Switch Environments',
  meta: true,
  alt: false,
  shift: true,
  keycode: keycodes.e
};

export const TOGGLE_METHOD_DROPDOWN: Hotkey = {
  description: 'Change HTTP Method',
  meta: true,
  alt: false,
  shift: true,
  keycode: keycodes.l
};

export const TOGGLE_HISTORY_DROPDOWN: Hotkey = {
  description: 'Show Request History',
  meta: true,
  alt: false,
  shift: true,
  keycode: keycodes.h
};

export const FOCUS_URL: Hotkey = {
  description: 'Focus URL',
  meta: true,
  alt: false,
  shift: false,
  keycode: keycodes.l
};

export const GENERATE_CODE: Hotkey = {
  description: 'Generate Code',
  meta: true,
  alt: false,
  shift: true,
  keycode: keycodes.g
};

export const FOCUS_FILTER: Hotkey = {
  description: 'Filter Sidebar',
  meta: true,
  alt: false,
  shift: true,
  keycode: keycodes.f
};

export const SHOW_COOKIES: Hotkey = {
  description: 'Edit Cookies',
  meta: true,
  alt: false,
  shift: false,
  keycode: keycodes.k
};

export const CREATE_REQUEST: Hotkey = {
  description: 'Create Request',
  meta: true,
  alt: false,
  shift: false,
  keycode: keycodes.n
};

export const DELETE_REQUEST: Hotkey = {
  description: 'Delete Request',
  meta: true,
  alt: false,
  shift: true,
  keycode: keycodes.delete
};

export const CREATE_FOLDER: Hotkey = {
  description: 'Create Folder',
  meta: true,
  alt: false,
  shift: true,
  keycode: keycodes.n
};

export const DUPLICATE_REQUEST: Hotkey = {
  description: 'Duplicate Request',
  meta: true,
  alt: false,
  shift: false,
  keycode: keycodes.d
};

export const CLOSE_DROPDOWN: Hotkey = {
  description: 'Close Dropdown',
  meta: false,
  alt: false,
  shift: false,
  keycode: keycodes.esc
};

export const CLOSE_MODAL: Hotkey = {
  description: 'Close Modal',
  meta: false,
  alt: false,
  shift: false,
  keycode: keycodes.esc
};

export function pressedHotKey(e: KeyboardEvent, definition: Hotkey): boolean {
  const isMetaPressed = isMac() ? e.metaKey : e.ctrlKey;
  const isAltPressed = isMac() ? e.ctrlKey : e.altKey;
  const isShiftPressed = e.shiftKey;

  const { meta, alt, shift, keycode } = definition;
  const codes = Array.isArray(keycode) ? keycode : [keycode];

  for (const code of codes) {
    if ((alt && !isAltPressed) || (!alt && isAltPressed)) {
      continue;
    }

    if ((meta && !isMetaPressed) || (!meta && isMetaPressed)) {
      continue;
    }

    if ((shift && !isShiftPressed) || (!shift && isShiftPressed)) {
      continue;
    }

    if (code !== e.keyCode) {
      continue;
    }

    return true;
  }

  return false;
}

export function executeHotKey(
  e: KeyboardEvent,
  definition: Hotkey,
  callback: Function
): void {
  if (pressedHotKey(e, definition)) {
    callback();
  }
}

export function getChar(hotkey: Hotkey) {
  const codes = Array.isArray(hotkey.keycode)
    ? hotkey.keycode
    : [hotkey.keycode];
  const chars = [];

  for (const keycode of codes) {
    const v = Object.keys(keycodes).find(k => keycodes[k] === keycode);

    if (!v) {
      console.error('Invalid hotkey', hotkey);
    } else if (v.toUpperCase() === 'ENTER') {
      chars.push('Enter');
    } else if (v.toUpperCase() === 'DELETE') {
      chars.push('Delete');
    } else if (v.toUpperCase() === 'COMMA') {
      chars.push(',');
    } else if (v.toUpperCase() === 'BACKSLASH') {
      chars.push('\\');
    } else if (v.toUpperCase() === 'FORWARDSLASH') {
      chars.push('/');
    } else if (v.toUpperCase() === 'SPACE') {
      chars.push('Space');
    } else {
      chars.push(v.toUpperCase());
    }
  }

  return chars[0] || 'unknown';
}
