import * as electron from 'electron';
import mkdirp from 'mkdirp';
import { join } from 'path';

import appConfig from '../../config/config.json';

export function clickLink(href: string) {
  const { protocol } = new URL(href);
  if (protocol === 'http:' || protocol === 'https:') {
    // eslint-disable-next-line no-restricted-properties -- this is, other than tests, what _should be_ the one and only place in this project where this is called.
    electron.shell.openExternal(href);
  }
}

export function getDesignerDataDir() {
  const { app } = electron.remote || electron;
  return process.env.DESIGNER_DATA_PATH || join(app.getPath('appData'), 'Insomnia Designer');
}

export function getDataDirectory() {
  const { app } = electron.remote || electron;
  return process.env.INSOMNIA_DATA_PATH || app.getPath('userData');
}

export function getViewportSize(): string | null {
  const { BrowserWindow } = electron.remote || electron;
  const browserWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

  if (browserWindow) {
    const { width, height } = browserWindow.getContentBounds();
    return `${width}x${height}`;
  } else {
    // No windows open
    return null;
  }
}

export function getScreenResolution() {
  const { screen } = electron.remote || electron;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return `${width}x${height}`;
}

export function getUserLanguage() {
  const { app } = electron.remote || electron;
  return app.getLocale();
}

export function getTempDir() {
  // NOTE: Using a fairly unique name here because "insomnia" is a common word
  const { app } = electron.remote || electron;
  const dir = join(app.getPath('temp'), `insomnia_${appConfig.version}`);
  mkdirp.sync(dir);
  return dir;
}

export function restartApp() {
  const { app } = electron.remote || electron;
  app.relaunch();
  app.exit();
}

export const setMenuBarVisibility = (visible: boolean) => {
  const { BrowserWindow } = electron.remote || electron;
  BrowserWindow.getAllWindows()
    .forEach(window => {
      // the `setMenuBarVisibility` signature uses `visible` semantics
      window.setMenuBarVisibility(visible);

      // the `setAutoHideMenu` signature uses `hide` semantics
      const hide = !visible;
      window.setAutoHideMenuBar(hide);
    });
};
