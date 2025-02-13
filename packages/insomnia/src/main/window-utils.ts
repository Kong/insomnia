import * as Sentry from '@sentry/electron/main';
import {
  app,
  BrowserWindow,
  type BrowserWindow as ElectronBrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
  MessageChannelMain,
  screen,
  shell,
} from 'electron';
import fs from 'fs';
import * as os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

import {
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
import { APP_START_TIME, SentryMetrics } from '../common/sentry';
import { invariant } from '../utils/invariant';
import ElectronStorage from './electron-storage';
import { ipcMainOn } from './ipc/electron';

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const MINIMUM_WIDTH = 500;
const MINIMUM_HEIGHT = 400;

const browserWindows = new Map<'Insomnia' | 'HiddenBrowserWindow', ElectronBrowserWindow>();
let electronStorage: ElectronStorage | null = null;
let hiddenWindowIsBusy = false;

interface Bounds {
  height?: number;
  width?: number;
  x?: number;
  y?: number;
}

export function init() {
  initElectronStorage();
}
const stopAndWaitForHiddenBrowserWindow = async (runningHiddenBrowserWindow: BrowserWindow) => {
  return await new Promise<void>(resolve => {
    // overwrite the closed handler
    runningHiddenBrowserWindow.on('closed', () => {
      console.log('[main] restarting hidden browser window:', runningHiddenBrowserWindow.id);
      browserWindows.delete('HiddenBrowserWindow');
      resolve();
    });
    stopHiddenBrowserWindow();
  });
};

export async function createHiddenBrowserWindow() {
  const mainWindow = browserWindows.get('Insomnia');
  invariant(mainWindow, 'MainWindow is not defined, please restart the app.');

  console.log('[main] Registering the hidden window restarting handler');
  ipcMainOn('set-hidden-window-busy-status', (_, busyStatus) => {
    hiddenWindowIsBusy = busyStatus;
  });
  // this avoids registering handler multiple times and output an error
  ipcMain.removeHandler('open-channel-to-hidden-browser-window');
  // when the main window runs a script
  // if the hidden window is down, start it
  ipcMain.handle('open-channel-to-hidden-browser-window', async (event, isPortAlive: boolean) => {
    const runningHiddenBrowserWindow = browserWindows.get('HiddenBrowserWindow');
    const isRunning = !!runningHiddenBrowserWindow;
    // if window crashed
    const windowWasClosedUnexpectedly = hiddenWindowIsBusy && !isRunning;
    if (windowWasClosedUnexpectedly) {
      hiddenWindowIsBusy = false;
    }

    const hiddenWindowIsNotBusy = !hiddenWindowIsBusy;
    const isHealthy = hiddenWindowIsNotBusy && isRunning && isPortAlive;
    if (isHealthy) {
      return;
    }

    // if window froze
    const isRunningButUnhealthy = isRunning && !isHealthy;
    if (isRunningButUnhealthy) {
      // stop and wait for window close event and sync the map and busy status
      await stopAndWaitForHiddenBrowserWindow(runningHiddenBrowserWindow);
    }

    console.log('[main] hidden window is down, restarting');
    const hiddenBrowserWindow = new BrowserWindow({
      show: false,
      title: 'HiddenBrowserWindow',
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      minHeight: MINIMUM_HEIGHT,
      minWidth: MINIMUM_WIDTH,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
        preload: path.join(__dirname, 'hidden-window-preload.js'),
        spellcheck: false,
        devTools: process.env.NODE_ENV === 'development',
      },
    });

    hiddenBrowserWindow.on('closed', () => {
      if (browserWindows.get('HiddenBrowserWindow')) {
        console.log('[main] closing hidden browser window');
        browserWindows.delete('HiddenBrowserWindow');
      }
    });

    const hiddenBrowserWindowPath = path.resolve(__dirname, 'hidden-window.html');
    const hiddenBrowserWindowUrl = process.env.HIDDEN_BROWSER_WINDOW_URL || pathToFileURL(hiddenBrowserWindowPath).href;
    hiddenBrowserWindow.loadURL(hiddenBrowserWindowUrl);
    console.log(`[main] Loading ${hiddenBrowserWindowUrl}`);

    ipcMain.removeHandler('renderer-listener-ready');
    const hiddenWinListenerReady = new Promise<void>(resolve => {
      ipcMain.handleOnce('renderer-listener-ready', () => {
        console.log('[main] hidden window listener is ready');
        resolve();
      });
    });
    await hiddenWinListenerReady;

    ipcMain.removeHandler('hidden-window-received-port');
    const hiddenWinPortReady = new Promise<void>(resolve => {
      ipcMain.handleOnce('hidden-window-received-port', () => {
        console.log('[main] hidden window has received port');
        resolve();
      });
    });

    const { port1, port2 } = new MessageChannelMain();
    hiddenBrowserWindow.webContents.postMessage('renderer-listener', null, [port1]);
    await hiddenWinPortReady;

    ipcMain.removeHandler('main-window-script-port-ready');
    const mainWinPortReady = new Promise<void>(resolve => {
      ipcMain.handleOnce('main-window-script-port-ready', () => {
        console.log('[main] main window has received hidden window port');
        resolve();
      });
    });

    event.senderFrame?.postMessage('hidden-browser-window-response-listener', null, [port2]);
    await mainWinPortReady;

    browserWindows.set('HiddenBrowserWindow', hiddenBrowserWindow);
  });
}

export function stopHiddenBrowserWindow() {
  browserWindows.get('HiddenBrowserWindow')?.close();
  hiddenWindowIsBusy = false;
}

export function createWindow({ firstLaunch }: { firstLaunch?: boolean } = {}): ElectronBrowserWindow {
  const { bounds, fullscreen, maximize } = getBounds();
  const { x, y, width, height } = bounds;

  const appLogo = 'static/insomnia-core-logo_16x.png';
  let isVisibleOnAnyDisplay = true;

  for (const d of screen.getAllDisplays()) {
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

  const mainBrowserWindow = new BrowserWindow({
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
      nodeIntegrationInWorker: true,
      webviewTag: true,
      // TODO: enable context isolation
      contextIsolation: false,
      disableBlinkFeatures: 'Auxclick',
    },
  });
  browserWindows.set('Insomnia', mainBrowserWindow);

  // BrowserWindow doesn't have an option for this, so we have to do it manually :(
  if (maximize) {
    mainBrowserWindow.maximize();
  }

  mainBrowserWindow.on('resize', () => saveBounds());
  mainBrowserWindow.on('maximize', () => saveBounds());
  mainBrowserWindow.on('unmaximize', () => saveBounds());
  mainBrowserWindow.on('move', () => saveBounds());
  mainBrowserWindow.on('unresponsive', () => {
    showUnresponsiveModal();
  });

  // Open generic links (<a .../>) in default browser
  mainBrowserWindow.webContents.on('will-navigate', (event, url) => {
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

  mainBrowserWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Load the html of the app.
  const appPath = path.resolve(__dirname, './index.html');
  const appUrl = process.env.APP_RENDER_URL || pathToFileURL(appPath).href;

  console.log(`[main] Loading ${appUrl}`);
  if (firstLaunch) {
    const duration = performance.now() - APP_START_TIME;
    Sentry.metrics.distribution(SentryMetrics.MAIN_PROCESS_START_DURATION, duration, {
      unit: 'millisecond',
    });
  }
  mainBrowserWindow.loadURL(appUrl);
  // Emitted when the window is closed.
  mainBrowserWindow.on('closed', () => {
    if (browserWindows.get('Insomnia')) {
      browserWindows.delete('Insomnia');
    }
  });

  mainBrowserWindow.on('focus', () => {
    console.log('[main] window focus');
    mainBrowserWindow.webContents.send('mainWindowFocusChange', true);
  });

  mainBrowserWindow.on('blur', () => {
    console.log('[main] window blur');
    mainBrowserWindow.webContents.send('mainWindowFocusChange', false);
  });

  const applicationMenu: MenuItemConstructorOptions = {
    label: `${MNEMONIC_SYM}Application`,
    submenu: [
      {
        label: `${MNEMONIC_SYM}Preferences`,
        click: () => {
          mainBrowserWindow.webContents?.send('toggle-preferences');
        },
      },
      {
        label: `${MNEMONIC_SYM}Changelog`,
        // eslint-disable-next-line no-restricted-properties
        click: () => shell.openExternal('https://github.com/Kong/insomnia/releases'),
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
          mainBrowserWindow.setBounds({
            width: 960,
            height: 540,
          }),
      },
      {
        label: `Resize to Defaul${MNEMONIC_SYM}t (HD 720)`,
        click: () =>
          mainBrowserWindow.setBounds({
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
          }),
      },
      {
        label: `Resize to ${MNEMONIC_SYM}Large (FHD 1080)`,
        click: () =>
          mainBrowserWindow.setBounds({
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
        click: () => {
          mainBrowserWindow.webContents.send('toggle-preferences-shortcuts');
        },
      },
      {
        type: 'separator',
      },
      {
        label: `Show App ${MNEMONIC_SYM}Data Folder`,
        click: () => {
          const directory = process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData');
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
        label: 'Show Software Bill of Materials',
        click: () => {
          // eslint-disable-next-line no-restricted-properties
          shell.openExternal('https://github.com/Kong/insomnia/releases');
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
        label: 'Check for updates',
        click: () => {
          ipcMain.emit('manualUpdateCheck');
        },
      },
      {
        type: 'separator',
      },
    );
  } else {
    // @ts-expect-error -- TSCONVERSION type splitting
    helpMenu.submenu?.push(
      {
        type: 'separator',
      },
      {
        label: 'Check for updates',
        click: () => {
          ipcMain.emit('manualUpdateCheck');
        },
      },
      {
        label: `${MNEMONIC_SYM}About`,
        click: aboutMenuClickHandler,
      }
    );
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
        click: () => {
          // @ts-expect-error -- TSCONVERSION not accounted for in the electron types to provide a function
          mainBrowserWindow.capturePage(image => {
            const buffer = image.toPNG();
            const dir = app.getPath('desktop');
            fs.writeFileSync(path.join(dir, `Screenshot-${new Date()}.png`), buffer);
          });
        },
      },
      {
        label: `${MNEMONIC_SYM}Clear a model`,
        click: () => {
          mainBrowserWindow.webContents?.send('clear-model');
        },
      },
      {
        label: `Clear ${MNEMONIC_SYM}all models`,
        click: () => {
          mainBrowserWindow.webContents?.send('clear-all-models');
        },
      },
      {
        label: `R${MNEMONIC_SYM}estart`,
        click: window?.main.restart,
      },
      {
        label: `Set window for ${MNEMONIC_SYM}FHD Screenshot`,
        click: () => {
          mainBrowserWindow.setBounds({
            width: 1920,
            height: 1080,
          });
          setZoom(() => 4)();
        },
      },
      {
        label: 'Show/hide hidden browser window ',
        click: () => {
          const hiddenBrowserWindow = browserWindows.get('HiddenBrowserWindow');
          invariant(hiddenBrowserWindow, 'hiddenBrowserWindow is not defined');
          hiddenBrowserWindow.isVisible() ? hiddenBrowserWindow.hide() : hiddenBrowserWindow.show();
        },
      },
      {
        label: 'Stop/start hidden browser window ',
        click: () => {
          const hiddenBrowserWindow = browserWindows.get('HiddenBrowserWindow');
          hiddenBrowserWindow ? stopHiddenBrowserWindow() : createHiddenBrowserWindow();
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
  return mainBrowserWindow;
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
    electronStorage?.setItem('bounds', browserWindow?.getBounds());
    electronStorage?.setItem('maximize', browserWindow?.isMaximized());
    electronStorage?.setItem('fullscreen', false);
  } else {
    electronStorage?.setItem('fullscreen', true);
  }
}

function getBounds() {
  let bounds: Bounds = {};
  let fullscreen = false;
  let maximize = false;

  try {
    bounds = electronStorage?.getItem('bounds', {});
    fullscreen = electronStorage?.getItem('fullscreen', false);
    maximize = electronStorage?.getItem('maximize', false);
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
    return electronStorage?.getItem('zoomFactor', ZOOM_DEFAULT);
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
  electronStorage?.setItem('zoomFactor', actual);
};

export function initElectronStorage() {
  const electronStoragePath = path.join(process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData'), 'localStorage');
  if (!electronStorage) {
    electronStorage = new ElectronStorage(electronStoragePath);
  }
  return electronStorage;
}

export function createWindowsAndReturnMain({ firstLaunch }: { firstLaunch?: boolean } = {}) {
  const mainWindow = browserWindows.get('Insomnia') ?? createWindow({ firstLaunch });
  if (!browserWindows.get('HiddenBrowserWindow')) {
    createHiddenBrowserWindow();
  }
  return mainWindow;
}
