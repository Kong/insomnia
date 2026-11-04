import { app, type Menu } from 'electron';

let appMenu: Menu | null = null;

export const getAppMenu = () => appMenu;

export const setAppMenu = (menu: Menu) => {
  appMenu = menu;
};

// Chromium crashes when creating the overlay on the headless backend
export const hasTitleBarOverlay = () =>
  process.platform !== 'darwin' && app.commandLine.getSwitchValue('ozone-platform') !== 'headless';
