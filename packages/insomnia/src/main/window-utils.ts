import electron, { type BrowserWindow as ElectronBrowserWindow, type MenuItemConstructorOptions } from 'electron';
import fs from 'fs';
import * as os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

import {
  changelogUrl,
  getAppBuildDate,
  getAppVersion,
  getProductName,
  isDevelopment,
  isLinux,
  isMac,
  MNEMONIC_SYM,
} from '../common/constants';
import { docsBase } from '../common/documentation';
import * as log from '../common/log';
import LocalStorage from './local-storage';

const { app, Menu, shell, dialog, clipboard, BrowserWindow } = electron;

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const MINIMUM_WIDTH = 500;
const MINIMUM_HEIGHT = 400;

let newWindow: ElectronBrowserWindow | null = null;
const windows = new Set<ElectronBrowserWindow>();
let localStorage: LocalStorage | null = null;

interface Bounds {
  height?: number;
  width?: number;
  x?: number;
  y?: number;
}

export function init() {
  initLocalStorage();
}

export function createWindow() {
  const { bounds, fullscreen, maximize } = getBounds();
  const { x, y, width, height } = bounds;

  const appLogo = 'static/insomnia-core-logo_16x.png';
  let isVisibleOnAnyDisplay = true;

  for (const d of electron.screen.getAllDisplays()) {
    const isVisibleOnDisplay =
      // @ts-expect-error -- TSCONVERSION genuine error
      x >= d.bounds.x &&
      // @ts-expect-error -- TSCONVERSION genuine error
      y >= d.bounds.y &&
      // @ts-expect-error -- TSCONVERSION genuine error
      x + width <= d.bounds.x + d.bounds.width &&
      // @ts-expect-error -- TSCONVERSION genuine error
      y + height <= d.bounds.y + d.bounds.height;

    if (!isVisibleOnDisplay) {
      isVisibleOnAnyDisplay = false;
    }
  }

  newWindow = new BrowserWindow({
    // Make sure we don't initialize the window outside the bounds
    x: isVisibleOnAnyDisplay ? x : undefined,
    y: isVisibleOnAnyDisplay ? y : undefined,
    // Other options
    backgroundColor: '#2C2C2C',
    fullscreen: fullscreen,
    fullscreenable: true,
    title: getProductName(),
    width: width || DEFAULT_WIDTH,
    height: height || DEFAULT_HEIGHT,
    minHeight: MINIMUM_HEIGHT,
    minWidth: MINIMUM_WIDTH,
    acceptFirstMouse: true,
    icon: path.resolve(__dirname, appLogo),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      zoomFactor: getZoomFactor(),
      nodeIntegration: true,
      webviewTag: true,
      // TODO: enable context isolation
      contextIsolation: false,
      disableBlinkFeatures: 'Auxclick',
    },
  });

  // BrowserWindow doesn't have an option for this, so we have to do it manually :(
  if (maximize) {
    newWindow?.maximize();
  }

  newWindow?.on('resize', () => saveBounds());
  newWindow?.on('maximize', () => saveBounds());
  newWindow?.on('unmaximize', () => saveBounds());
  newWindow?.on('move', () => saveBounds());
  newWindow?.on('unresponsive', () => {
    showUnresponsiveModal();
  });

  // Open generic links (<a .../>) in default browser
  newWindow?.webContents.on('will-navigate', (event, url) => {
    // Prevents local dev full-reload events from opening browser window, see https://github.com/Kong/insomnia/pull/4925
    if (url.startsWith(appUrl)) {
      return;
    }

    console.log('[app] Navigate to ' + url);
    event.preventDefault();
    const { protocol } = new URL(url);
    if (protocol === 'http:' || protocol === 'https:') {
      // eslint-disable-next-line no-restricted-properties
      shell.openExternal(url);
    }
  });

  newWindow?.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Load the html of the app.
  const appPath = path.resolve(__dirname, './index.html');
  const appUrl = process.env.APP_RENDER_URL || pathToFileURL(appPath).href;

  console.log(`[main] Loading ${appUrl}`);
  newWindow?.loadURL(appUrl);
  // Emitted when the window is closed.
  newWindow?.on('closed', () => {
    if (newWindow) {
      windows.delete(newWindow);
      newWindow = windows.values().next().value || null;
    }
  });

  const applicationMenu: MenuItemConstructorOptions = {
    label: `${MNEMONIC_SYM}Application`,
    submenu: [
      {
        label: `${MNEMONIC_SYM}Preferences`,
        click: function(_menuItem, window) {
          if (!window || !window.webContents) {
            return;
          }

          window.webContents.send('toggle-preferences');
        },
      },
      {
        label: `${MNEMONIC_SYM}Changelog`,
        click: function(_menuItem, window) {
          if (!window || !window.webContents) {
            return;
          }

          const href = changelogUrl();
          const { protocol } = new URL(href);
          if (protocol === 'http:' || protocol === 'https:') {
            // eslint-disable-next-line no-restricted-properties
            shell.openExternal(href);
          }
        },
      },
      {
        type: 'separator',
      },
      {
        role: 'hide',
      },
      {
        // @ts-expect-error -- TSCONVERSION appears to be a genuine error
        role: 'hideothers',
      },
      {
        type: 'separator',
      },
      {
        label: `${MNEMONIC_SYM}Quit`,
        accelerator: 'CmdOrCtrl+Q',
        click: () => app.quit(),
      },
    ],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: `${MNEMONIC_SYM}Edit`,
    submenu: [
      {
        label: `${MNEMONIC_SYM}Undo`,
        accelerator: 'CmdOrCtrl+Z',
        role: 'undo',
      },
      {
        label: `${MNEMONIC_SYM}Redo`,
        accelerator: 'Shift+CmdOrCtrl+Z',
        role: 'redo',
      },
      {
        type: 'separator',
      },
      {
        label: `Cu${MNEMONIC_SYM}t`,
        accelerator: 'CmdOrCtrl+X',
        role: 'cut',
      },
      {
        label: `${MNEMONIC_SYM}Copy`,
        accelerator: 'CmdOrCtrl+C',
        role: 'copy',
      },
      {
        label: `${MNEMONIC_SYM}Paste`,
        accelerator: 'CmdOrCtrl+V',
        role: 'paste',
      },
      {
        label: `Select ${MNEMONIC_SYM}All`,
        accelerator: 'CmdOrCtrl+A',
        role: 'selectAll',
      },
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: `${MNEMONIC_SYM}View`,
    submenu: [
      {
        label: `Toggle ${MNEMONIC_SYM}Full Screen`,
        role: 'togglefullscreen',
      },
      {
        label: `${MNEMONIC_SYM}Actual Size`,
        accelerator: 'CmdOrCtrl+0',
        click: setZoom(() => 1),
      },
      {
        label: `Zoom ${MNEMONIC_SYM}In`,
        accelerator: 'CmdOrCtrl+=',
        click: setZoom(zoom => zoom * 1.2),
      },
      {
        label: `Zoom ${MNEMONIC_SYM}Out`,
        accelerator: 'CmdOrCtrl+-',
        click: setZoom(zoom => zoom * 0.8),
      },
      {
        label: 'Specific Zoom Level',
        submenu: [25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 350, 400, 500].map(item => ({
          label: `${item}%`,
          click: setZoom(() => item / 100),
        })),
      },
      {
        type: 'separator',
      },
      {
        label: `Resize to ${MNEMONIC_SYM}Small (qHD 540)`,
        click: () =>
          newWindow?.setBounds({
            width: 960,
            height: 540,
          }),
      },
      {
        label: `Resize to Defaul${MNEMONIC_SYM}t (HD 720)`,
        click: () =>
          newWindow?.setBounds({
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
          }),
      },
      {
        label: `Resize to ${MNEMONIC_SYM}Large (FHD 1080)`,
        click: () =>
          newWindow?.setBounds({
            width: 1920,
            height: 1080,
          }),
      },
      {
        type: 'separator',
      },
      {
        label: 'Toggle Sidebar',
        click: () => {
          const w = BrowserWindow.getFocusedWindow();

          if (!w || !w.webContents) {
            return;
          }

          w.webContents.send('toggle-sidebar');
        },
      },
      {
        label: `Toggle ${MNEMONIC_SYM}DevTools`,
        accelerator: 'Alt+CmdOrCtrl+I',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (window) {
            // @ts-expect-error -- TSCONVERSION needs global module augmentation
            window.toggleDevTools();
          }
        },
      },
    ],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: `${MNEMONIC_SYM}Window`,
    role: 'window',
    submenu: [
      {
        label: `${MNEMONIC_SYM}New`,
        click: () => {
          createWindow();
        },
      },
      {
        label: `${MNEMONIC_SYM}Minimize`,
        role: 'minimize',
      },
      // @ts-expect-error -- TSCONVERSION missing in official electron types
      ...(isMac() ? [
        {
          label: `${MNEMONIC_SYM}Close`,
          role: 'close',
        },
      ]
        : []),
    ],
  };

  const helpMenu: MenuItemConstructorOptions = {
    label: `${MNEMONIC_SYM}Help`,
    role: 'help',
    id: 'help',
    submenu: [
      {
        label: `${MNEMONIC_SYM}Help and Support`,
        ...(isMac() ? {} : { accelerator: 'F1' }),
        click: () => {
          const { protocol } = new URL(docsBase);
          if (protocol === 'http:' || protocol === 'https:') {
            // eslint-disable-next-line no-restricted-properties
            shell.openExternal(docsBase);
          }
        },
      },
      {
        label: `${MNEMONIC_SYM}Keyboard Shortcuts`,
        accelerator: 'CmdOrCtrl+Shift+?',
        click: (_menuItem, w) => {
          if (!w || !w.webContents) {
            return;
          }

          w.webContents.send('toggle-preferences-shortcuts');
        },
      },
      {
        type: 'separator',
      },
      {
        label: `Show App ${MNEMONIC_SYM}Data Folder`,
        click: () => {
          const directory = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');
          shell.showItemInFolder(directory);
        },
      },
      {
        label: `Show App ${MNEMONIC_SYM}Logs Folder`,
        click: () => {
          const directory = log.getLogDirectory();
          shell.showItemInFolder(directory);
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Show Open Source Licenses',
        click: () => {
          const licensePath = path.resolve(app.getAppPath(), '../opensource-licenses.txt');
          shell.openPath(licensePath);
        },
      },
      {
        label: 'Show Software License',
        click: () => {
          // eslint-disable-next-line no-restricted-properties
          shell.openExternal('https://insomnia.rest/license');
        },
      },
    ],
  };

  const aboutMenuClickHandler = async () => {
    const copy = 'Copy';
    const ok = 'OK';
    const buttons = isLinux() ? [copy, ok] : [ok, copy];
    const detail = [
      `Version: ${getProductName()} ${getAppVersion()}`,
      `Build date: ${getAppBuildDate()}`,
      `OS: ${os.type()} ${os.arch()} ${os.release()}`,
      `Electron: ${process.versions.electron}`,
      `Node: ${process.versions.node}`,
      `Node ABI: ${process.versions.modules}`,
      `V8: ${process.versions.v8}`,
      `Architecture: ${process.arch}`,
    ].join('\n');

    const msgBox = await dialog.showMessageBox({
      type: 'info',
      title: getProductName(),
      message: getProductName(),
      detail,
      buttons,
      defaultId: buttons.indexOf(ok),
      cancelId: buttons.indexOf(ok),
      noLink: true,
    });

    if (msgBox.response === buttons.indexOf(copy)) {
      clipboard.writeText(detail);
    }
  };

  if (isMac()) {
    // @ts-expect-error -- TSCONVERSION type splitting
    applicationMenu.submenu?.unshift(
      {
        label: `A${MNEMONIC_SYM}bout ${getProductName()}`,
        click: aboutMenuClickHandler,
      },
      {
        type: 'separator',
      },
    );
  } else {
    // @ts-expect-error -- TSCONVERSION type splitting
    helpMenu.submenu?.push({
      type: 'separator',
    },
    {
      label: `${MNEMONIC_SYM}About`,
      click: aboutMenuClickHandler,
    });
  }

  const developerMenu: MenuItemConstructorOptions = {
    label: `${MNEMONIC_SYM}Developer`,
    // @ts-expect-error -- TSCONVERSION missing in official electron types
    position: 'before=help',
    submenu: [
      {
        label: `${MNEMONIC_SYM}Reload`,
        accelerator: 'Shift+F5',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (window) {
            window.reload();
          }
        },
      },
      {
        label: `Take ${MNEMONIC_SYM}Screenshot`,
        click: function() {
          // @ts-expect-error -- TSCONVERSION not accounted for in the electron types to provide a function
          newWindow?.capturePage(image => {
            const buffer = image.toPNG();
            const dir = app.getPath('desktop');
            fs.writeFileSync(path.join(dir, `Screenshot-${new Date()}.png`), buffer);
          });
        },
      },
      {
        label: `${MNEMONIC_SYM}Clear a model`,
        click: function(_menuItem, window) {
          window?.webContents?.send('clear-model');
        },
      },
      {
        label: `Clear ${MNEMONIC_SYM}all models`,
        click: function(_menuItem, window) {
          window?.webContents?.send('clear-all-models');
        },
      },
      {
        label: `R${MNEMONIC_SYM}estart`,
        click: window?.main.restart,
      },
      {
        label: `Set window for ${MNEMONIC_SYM}FHD Screenshot`,
        click: () => {
          newWindow?.setBounds({
            width: 1920,
            height: 1080,
          });
          setZoom(() => 4)();
        },
      },
    ],
  };
  const toolsMenu: MenuItemConstructorOptions = {
    label: `${MNEMONIC_SYM}Tools`,
    submenu: [
      {
        label: `${MNEMONIC_SYM}Reload Plugins`,
        click: () => {
          const w = BrowserWindow.getFocusedWindow();

          if (!w || !w.webContents) {
            return;
          }

          w.webContents.send('reload-plugins');
        },
      },
    ],
  };
  const template: MenuItemConstructorOptions[] = [];
  template.push(applicationMenu);
  template.push({
    label: `${MNEMONIC_SYM}File`,
    submenu: [
      {
        label: `${MNEMONIC_SYM}New Window`,
        click: () => {
          createWindow();
        },
      },
    ],
  });
  template.push(editMenu);
  template.push(viewMenu);
  template.push(windowMenu);
  template.push(toolsMenu);
  template.push(helpMenu);

  if (isDevelopment() || process.env.INSOMNIA_FORCE_DEBUG) {
    template.push(developerMenu);
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  windows.add(newWindow);
  return newWindow;
}

async function showUnresponsiveModal() {
  const id = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Cancel', 'Reload'],
    defaultId: 1,
    cancelId: 0,
    title: 'Unresponsive',
    message: 'Insomnia has become unresponsive. Do you want to reload?',
  });

  // @ts-expect-error -- TSCONVERSION appears to be a genuine error
  if (id === 1) {
    const browserWindow = BrowserWindow.getFocusedWindow();

    if (!browserWindow || !browserWindow.webContents) {
      return;
    }
    browserWindow?.destroy();
    createWindow();
  }
}

function saveBounds() {
  const browserWindow = BrowserWindow.getFocusedWindow();

  if (!browserWindow || !browserWindow.webContents) {
    return;
  }
  if (!browserWindow) {
    return;
  }

  const fullscreen = browserWindow?.isFullScreen();

  // Only save the size if we're not in fullscreen
  if (!fullscreen) {
    localStorage?.setItem('bounds', browserWindow?.getBounds());
    localStorage?.setItem('maximize', browserWindow?.isMaximized());
    localStorage?.setItem('fullscreen', false);
  } else {
    localStorage?.setItem('fullscreen', true);
  }
}

function getBounds() {
  let bounds: Bounds = {};
  let fullscreen = false;
  let maximize = false;

  try {
    bounds = localStorage?.getItem('bounds', {});
    fullscreen = localStorage?.getItem('fullscreen', false);
    maximize = localStorage?.getItem('maximize', false);
  } catch (error) {
    // This should never happen, but if it does...!
    console.error('Failed to parse window bounds', error);
  }

  return {
    bounds,
    fullscreen,
    maximize,
  };
}

const ZOOM_MAX = 6;
const ZOOM_DEFAULT = 1;
const ZOOM_MIN = 0.05;

const getZoomFactor = () => {
  try {
    return localStorage?.getItem('zoomFactor', ZOOM_DEFAULT);
  } catch (error) {
    // This should never happen, but if it does...!
    console.error('Failed to parse zoomFactor', error);
  }

  return ZOOM_DEFAULT;
};

export const setZoom = (transformer: (current: number) => number) => () => {
  const browserWindow = BrowserWindow.getFocusedWindow();

  if (!browserWindow || !browserWindow.webContents) {
    return;
  }

  const current = getZoomFactor();
  const desired = transformer(current);
  const actual = Math.min(Math.max(ZOOM_MIN, desired), ZOOM_MAX);

  browserWindow.webContents.setZoomLevel(actual);
  localStorage?.setItem('zoomFactor', actual);
};

function initLocalStorage() {
  const localStoragePath = path.join(process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData'), 'localStorage');
  localStorage = new LocalStorage(localStoragePath);
}

export function getOrCreateWindow() {
  return newWindow ?? createWindow();
}
