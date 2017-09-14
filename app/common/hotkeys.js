// @flow
export type Hotkey = {
  meta: boolean,
  alt: boolean,
  key: string | Array<string>
};

export const SHOW_WORKSPACE_SETTINGS: Hotkey = {
  meta: true,
  alt: false,
  key: '<'
};

export const TOGGLE_MAIN_MENU: Hotkey = {
  meta: true,
  alt: true,
  key: ','
};

export const SHOW_REQUEST_SETTINGS: Hotkey = {
  meta: true,
  alt: true,
  key: '<'
};

export const SHOW_QUICK_SWITCHER: Hotkey = {
  meta: true,
  alt: false,
  key: 'p'
};

export const SEND_REQUEST_META: Hotkey = {
  meta: true,
  alt: false,
  key: ['Enter', 'r']
};

export const SEND_REQUEST_F5: Hotkey = {
  meta: false,
  alt: false,
  key: 'F5'
};

export const SHOW_ENVIRONMENTS: Hotkey = {
  meta: true,
  alt: false,
  key: 'e'
};

export const TOGGLE_ENVIRONMENTS_MENU: Hotkey = {
  meta: true,
  alt: false,
  key: 'E'
};

export const TOGGLE_METHOD_DROPDOWN: Hotkey = {
  meta: true,
  alt: false,
  key: 'L'
};

export const FOCUS_URL: Hotkey = {
  meta: true,
  alt: false,
  key: 'l'
};

export const FOCUS_FILTER: Hotkey = {
  meta: true,
  alt: false,
  key: 'F'
};

export const SHOW_COOKIES: Hotkey = {
  meta: true,
  alt: false,
  key: 'k'
};

export const CREATE_REQUEST: Hotkey = {
  meta: true,
  alt: false,
  key: 'n'
};

export const CREATE_FOLDER: Hotkey = {
  meta: true,
  alt: false,
  key: 'N'
};

export const DUPLICATE_REQUEST: Hotkey = {
  meta: true,
  alt: false,
  key: 'd'
};

export const CLOSE_DROPDOWN: Hotkey = {
  meta: false,
  alt: false,
  key: 'Escape'
};
