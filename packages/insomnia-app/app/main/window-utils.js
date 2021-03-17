import electron from 'electron';
import path from 'path';
import { Curl } from 'node-libcurl';
import fs from 'fs';
import LocalStorage from './local-storage';
import {
  changelogUrl,
  getAppLongName,
  getAppName,
  getAppReleaseDate,
  getAppVersion,
  isDevelopment,
  isLinux,
  isMac,
  MNEMONIC_SYM,
} from '../common/constants';
import * as misc from '../common/misc';
import * as log from '../common/log';
import * as os from 'os';
import { docsBase } from '../common/documentation';

const { app, Menu, BrowserWindow, shell, dialog, clipboard } = electron;

// So we can use native modules in renderer
// NOTE: This will be deprecated in Electron 10 and impossible in 11
//   https://github.com/electron/electron/issues/18397
app.allowRendererProcessReuse = false;

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 700;
const MINIMUM_WIDTH = 500;
const MINIMUM_HEIGHT = 400;

let mainWindow = null;
let localStorage = null;

export function init() {
  initLocalStorage();
  initContextMenus();
}

export function createWindow() {
  const zoomFactor = getZoomFactor();
  const { bounds, fullscreen, maximize } = getBounds();
  const { x, y, width, height } = bounds;
  const appLogo = 'static/insomnia-core-logo_16x.png';

  let isVisibleOnAnyDisplay = true;
  for (const d of electron.screen.getAllDisplays()) {
    const isVisibleOnDisplay =
      x >= d.bounds.x &&
      y >= d.bounds.y &&
      x + width <= d.bounds.x + d.bounds.width &&
      y + height <= d.bounds.y + d.bounds.height;

    if (!isVisibleOnDisplay) {
      isVisibleOnAnyDisplay = false;
    }
  }

  mainWindow = new BrowserWindow({
    // Make sure we don't initialize the window outside the bounds
    x: isVisibleOnAnyDisplay ? x : undefined,
    y: isVisibleOnAnyDisplay ? y : undefined,

    // Other options
    fullscreen: fullscreen,
    fullscreenable: true,
    title: getAppName(),
    width: width || DEFAULT_WIDTH,
    height: height || DEFAULT_HEIGHT,
    minHeight: MINIMUM_HEIGHT,
    minWidth: MINIMUM_WIDTH,
    acceptFirstMouse: true,
    icon: path.resolve(__dirname, appLogo),
    webPreferences: {
      zoomFactor: zoomFactor,
      nodeIntegration: true,
      webviewTag: true,
      enableRemoteModule: true,
    },
  });

  // BrowserWindow doesn't have an option for this, so we have to do it manually :(
  if (maximize) {
    mainWindow.maximize();
  }

  mainWindow.on('resize', e => saveBounds());

  mainWindow.on('maximize', e => saveBounds());

  mainWindow.on('unmaximize', e => saveBounds());

  mainWindow.on('move', e => saveBounds());

  mainWindow.on('unresponsive', e => {
    showUnresponsiveModal();
  });

  // Open generic links (<a .../>) in default browser
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url === appUrl) {
      return;
    }

    console.log('[app] Navigate to ' + url);
    e.preventDefault();
    electron.shell.openExternal(url);
  });

  // Load the html of the app.
  const url = process.env.APP_RENDER_URL;
  const appUrl = url || `file://${app.getAppPath()}/renderer.html`;
  console.log(`[main] Loading ${appUrl}`);
  mainWindow.loadURL(appUrl);

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  const applicationMenu = {
    label: `${MNEMONIC_SYM}Application`,
    submenu: [
      {
        label: `${MNEMONIC_SYM}Preferences`,
        click: function(menuItem, window, e) {
          if (!window || !window.webContents) {
            return;
          }
          window.webContents.send('toggle-preferences');
        },
      },
      {
        label: `${MNEMONIC_SYM}Changelog`,
        click: function(menuItem, window, e) {
          if (!window || !window.webContents) {
            return;
          }
          misc.clickLink(changelogUrl());
        },
      },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideothers' },
      { type: 'separator' },
      { label: `${MNEMONIC_SYM}Quit`, accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
    ],
  };

  const editMenu = {
    label: `${MNEMONIC_SYM}Edit`,
    submenu: [
      { label: `${MNEMONIC_SYM}Undo`, accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
      { label: `${MNEMONIC_SYM}Redo`, accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
      { type: 'separator' },
      { label: `Cu${MNEMONIC_SYM}t`, accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
      { label: `${MNEMONIC_SYM}Copy`, accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
      { label: `${MNEMONIC_SYM}Paste`, accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
      {
        label: `Select ${MNEMONIC_SYM}All`,
        accelerator: 'CmdOrCtrl+A',
        selector: 'selectAll:',
      },
    ],
  };

  const viewMenu = {
    label: `${MNEMONIC_SYM}View`,
    submenu: [
      { label: `Toggle ${MNEMONIC_SYM}Full Screen`, role: 'togglefullscreen' },
      {
        label: `${MNEMONIC_SYM}Actual Size`,
        accelerator: 'CmdOrCtrl+0',
        click: () => {
          const w = BrowserWindow.getFocusedWindow();
          if (!w || !w.webContents) {
            return;
          }

          const zoomFactor = 1;
          w.webContents.setZoomFactor(zoomFactor);
          saveZoomFactor(zoomFactor);
        },
      },
      {
        label: `Zoom ${MNEMONIC_SYM}In`,
        accelerator: 'CmdOrCtrl+=',
        click: () => {
          const w = BrowserWindow.getFocusedWindow();
          if (!w || !w.webContents) {
            return;
          }

          const zoomFactor = Math.min(1.8, getZoomFactor() + 0.05);
          w.webContents.setZoomFactor(zoomFactor);

          saveZoomFactor(zoomFactor);
        },
      },
      {
        label: `Zoom ${MNEMONIC_SYM}Out`,
        accelerator: 'CmdOrCtrl+-',
        click: () => {
          const w = BrowserWindow.getFocusedWindow();
          if (!w || !w.webContents) {
            return;
          }

          const zoomFactor = Math.max(0.5, getZoomFactor() - 0.05);
          w.webContents.setZoomFactor(zoomFactor);
          saveZoomFactor(zoomFactor);
        },
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
        click: () => mainWindow.toggleDevTools(),
      },
    ],
  };

  const windowMenu = {
    label: `${MNEMONIC_SYM}Window`,
    role: 'window',
    submenu: [
      { label: `${MNEMONIC_SYM}Minimize`, role: 'minimize' },
      ...(isMac() ? [{ label: `${MNEMONIC_SYM}Close`, role: 'close' }] : []),
    ],
  };

  const helpMenu = {
    label: `${MNEMONIC_SYM}Help`,
    role: 'help',
    id: 'help',
    submenu: [
      {
        label: `${MNEMONIC_SYM}Help and Support`,
        accelerator: !isMac() ? 'F1' : null,
        click: () => {
          shell.openExternal(docsBase);
        },
      },
      {
        label: `${MNEMONIC_SYM}Keyboard Shortcuts`,
        accelerator: 'CmdOrCtrl+Shift+?',
        click: (menuItem, w, e) => {
          if (!w || !w.webContents) {
            return;
          }
          w.webContents.send('toggle-preferences-shortcuts');
        },
      },
      {
        label: `Show App ${MNEMONIC_SYM}Data Folder`,
        click: (menuItem, w, e) => {
          const directory = misc.getDataDirectory();
          shell.showItemInFolder(directory);
        },
      },
      {
        label: `Show App ${MNEMONIC_SYM}Logs Folder`,
        click: (menuItem, w, e) => {
          const directory = log.getLogDirectory();
          shell.showItemInFolder(directory);
        },
      },
      {
        label: 'Show Open Source Licenses',
        click: (menuItem, w, e) => {
          const licensePath = path.resolve(app.getAppPath(), '../opensource-licenses.txt');
          shell.openPath(licensePath);
        },
      },
      {
        label: 'Show Software License',
        click: () => {
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
      `Version: ${getAppLongName()} ${getAppVersion()}`,
      `Release date: ${getAppReleaseDate()}`,
      `OS: ${os.type()} ${os.arch()} ${os.release()}`,
      `Electron: ${process.versions.electron}`,
      `Node: ${process.versions.node}`,
      `V8: ${process.versions.v8}`,
      `Architecture: ${process.arch}`,
      `node-libcurl: ${Curl.getVersion()}`,
    ].join('\n');

    const msgBox = await dialog.showMessageBox({
      type: 'info',
      title: getAppName(),
      message: getAppLongName(),
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
    applicationMenu.submenu.unshift(
      {
        label: `A${MNEMONIC_SYM}bout ${getAppName()}`,
        click: aboutMenuClickHandler,
      },
      { type: 'separator' },
    );
  } else {
    helpMenu.submenu.push({
      label: `${MNEMONIC_SYM}About`,
      click: aboutMenuClickHandler,
    });
  }

  const developerMenu = {
    label: `${MNEMONIC_SYM}Developer`,
    position: 'before=help',
    submenu: [
      {
        label: `${MNEMONIC_SYM}Reload`,
        accelerator: 'Shift+F5',
        click: () => mainWindow.reload(),
      },
      {
        label: `Resize to Defaul${MNEMONIC_SYM}t`,
        click: () =>
          mainWindow.setBounds({
            x: 100,
            y: 100,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
          }),
      },
      {
        label: `Take ${MNEMONIC_SYM}Screenshot`,
        click: function() {
          mainWindow.capturePage(image => {
            const buffer = image.toPNG();
            const dir = app.getPath('desktop');
            fs.writeFileSync(path.join(dir, `Screenshot-${new Date()}.png`), buffer);
          });
        },
      },
      {
        label: `${MNEMONIC_SYM}Restart`,
        click: function() {
          const { app } = electron.remote || electron;
          app.relaunch();
          app.exit();
        },
      },
    ],
  };

  const toolsMenu = {
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

  const template = [];

  template.push(applicationMenu);
  template.push(editMenu);
  template.push(viewMenu);
  template.push(windowMenu);
  template.push(toolsMenu);
  template.push(helpMenu);

  if (isDevelopment() || process.env.INSOMNIA_FORCE_DEBUG) {
    template.push(developerMenu);
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  return mainWindow;
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

  if (id === 1) {
    mainWindow.destroy();
    createWindow();
  }
}

function saveBounds() {
  if (!mainWindow) {
    return;
  }

  const fullscreen = mainWindow.isFullScreen();

  // Only save the size if we're not in fullscreen
  if (!fullscreen) {
    localStorage.setItem('bounds', mainWindow.getBounds());
    localStorage.setItem('maximize', mainWindow.isMaximized());
    localStorage.setItem('fullscreen', false);
  } else {
    localStorage.setItem('fullscreen', true);
  }
}

function getBounds() {
  let bounds = {};
  let fullscreen = false;
  let maximize = false;
  try {
    bounds = localStorage.getItem('bounds', {});
    fullscreen = localStorage.getItem('fullscreen', false);
    maximize = localStorage.getItem('maximize', false);
  } catch (e) {
    // This should never happen, but if it does...!
    console.error('Failed to parse window bounds', e);
  }

  return { bounds, fullscreen, maximize };
}

function saveZoomFactor(zoomFactor) {
  localStorage.setItem('zoomFactor', zoomFactor);
}

function getZoomFactor() {
  let zoomFactor = 1;
  try {
    zoomFactor = localStorage.getItem('zoomFactor', 1);
  } catch (e) {
    // This should never happen, but if it does...!
    console.error('Failed to parse zoomFactor', e);
  }

  return zoomFactor;
}

function initLocalStorage() {
  const localStoragePath = path.join(misc.getDataDirectory(), 'localStorage');
  localStorage = new LocalStorage(localStoragePath);
}

function initContextMenus() {
  require('electron-context-menu')({});
}
