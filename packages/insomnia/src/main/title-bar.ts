import { app, type Menu, type MenuItem } from 'electron';

export interface AppMenuItem {
  type: 'normal' | 'separator' | 'checkbox' | 'radio';
  label: string;
  accelerator?: string;
  enabled: boolean;
  checked: boolean;
  path: number[];
  submenu?: AppMenuItem[];
}

let appMenu: Menu | null = null;

export const getAppMenu = () => appMenu;

export const setAppMenu = (menu: Menu) => {
  appMenu = menu;
};

// Role items keep their shortcut on a private getter instead of accelerator
const getAccelerator = (item: MenuItem & { getDefaultRoleAccelerator?: () => string | undefined }) =>
  (item.accelerator ?? item.getDefaultRoleAccelerator?.())?.replace(/CommandOrControl|CmdOrCtrl|Command|Cmd/, 'Ctrl');

export const serializeAppMenu = (menu: Menu, parentPath: number[] = []): AppMenuItem[] =>
  menu.items.flatMap((item, index) => {
    if (!item.visible) {
      return [];
    }
    const path = [...parentPath, index];
    return {
      type: item.type === 'submenu' ? 'normal' : (item.type as AppMenuItem['type']),
      label: item.label.replace(/&/g, ''),
      accelerator: getAccelerator(item),
      enabled: item.enabled,
      checked: item.checked,
      path,
      submenu: item.submenu ? serializeAppMenu(item.submenu, path) : undefined,
    };
  });

export const findAppMenuItem = (path: number[]) => {
  let items = appMenu?.items;
  let item: MenuItem | undefined;
  for (const index of path) {
    item = items?.[index];
    items = item?.submenu?.items;
  }
  return item;
};

// Chromium crashes when creating the overlay on the headless backend
export const hasTitleBarOverlay = () =>
  process.platform !== 'darwin' && app.commandLine.getSwitchValue('ozone-platform') !== 'headless';
