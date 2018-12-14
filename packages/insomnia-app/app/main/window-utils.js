import electron from 'electron';
import path from 'path';
import { Curl } from 'insomnia-libcurl';
import fs from 'fs';
import LocalStorage from './local-storage';
import {
  CHANGELOG_BASE_URL,
  MNEMONIC_SYM,
  getAppLongName,
  getAppName,
  getAppVersion,
  isDevelopment,
  isMac,
} from '../common/constants';
import * as misc from '../common/misc';

const { app, Menu, BrowserWindow, shell, dialog } = electron;

const DEFAULT_WIDTH = 1100;
const DEFAULT_HEIGHT = 550;
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

  // Make sure we don't place the window outside of the visible space
  let maxX = 0;
  let maxY = 0;
  for (const d of electron.screen.getAllDisplays()) {
    // Set the maximum placement location to 50 pixels short of the end
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width - 50);
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height - 50);
  }
  const finalX = Math.min(maxX, x);
  const finalY = Math.min(maxX, y);

  mainWindow = new BrowserWindow({
    // Make sure we don't initialize the window outside the bounds
    x: finalX,
    y: finalY,
    fullscreen: fullscreen,
    fullscreenable: true,
    title: getAppName(),
    width: width || DEFAULT_WIDTH,
    height: height || DEFAULT_HEIGHT,
    minHeight: MINIMUM_HEIGHT,
    minWidth: MINIMUM_WIDTH,
    acceptFirstMouse: true,
    icon: path.resolve(__dirname, 'static/icon.png'),
    webPreferences: {
      zoomFactor: zoomFactor,
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
      ...(isMac()
        ? [{ label: `A${MNEMONIC_SYM}bout ${getAppName()}`, role: 'about' }, { type: 'separator' }]
        : []),
      {
        label: `${MNEMONIC_SYM}Preferences`,
        accelerator: 'CmdOrCtrl+,',
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
          misc.clickLink(`${CHANGELOG_BASE_URL}/${getAppVersion()}/`);
        },
      },
      ...(isMac() ? [{ type: 'separator' }, { role: 'hide' }, { role: 'hideothers' }] : []),
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
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          const zoomFactor = 1;
          window.webContents.setZoomFactor(zoomFactor);
          saveZoomFactor(zoomFactor);
        },
      },
      {
        label: `Zoom ${MNEMONIC_SYM}In`,
        accelerator: isMac() ? 'CmdOrCtrl+Plus' : 'CmdOrCtrl+=',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          const zoomFactor = Math.min(1.8, getZoomFactor() + 0.05);
          window.webContents.setZoomFactor(zoomFactor);

          saveZoomFactor(zoomFactor);
        },
      },
      {
        label: `Zoom ${MNEMONIC_SYM}Out`,
        accelerator: 'CmdOrCtrl+-',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          const zoomFactor = Math.max(0.5, getZoomFactor() - 0.05);
          window.webContents.setZoomFactor(zoomFactor);
          saveZoomFactor(zoomFactor);
        },
      },
      {
        label: `Toggle ${MNEMONIC_SYM}Sidebar`,
        accelerator: 'CmdOrCtrl+\\',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          window.webContents.send('toggle-sidebar');
        },
      },
      {
        label: `Toggle ${MNEMONIC_SYM}DevTools`,
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
        label: `Contact ${MNEMONIC_SYM}Support`,
        click: () => {
          shell.openExternal('https://insomnia.rest/support/');
        },
      },
      {
        label: `${MNEMONIC_SYM}Keyboard Shortcuts`,
        accelerator: 'CmdOrCtrl+Shift+?',
        click: (menuItem, window, e) => {
          if (!window || !window.webContents) {
            return;
          }
          window.webContents.send('toggle-preferences-shortcuts');
        },
      },
      {
        label: `Show App ${MNEMONIC_SYM}Data Folder`,
        click: (menuItem, window, e) => {
          const directory = misc.getDataDirectory();
          shell.showItemInFolder(directory);
        },
      },
      {
        label: `Insomnia ${MNEMONIC_SYM}Help`,
        accelerator: !isMac() ? 'F1' : null,
        click: () => {
          shell.openExternal('https://support.insomnia.rest');
        },
      },
    ],
  };

  if (!isMac()) {
    helpMenu.submenu.unshift({
      label: `${MNEMONIC_SYM}About`,
      click: () => {
        dialog.showMessageBox({
          type: 'info',
          title: getAppName(),
          message: getAppLongName(),
          detail: [
            'Version ' + getAppVersion(),
            'Shell ' + process.versions.electron,
            'Node ' + process.versions.node,
            'V8 ' + process.versions.v8,
            'Architecture ' + process.arch,
            '', // Blank line before libcurl
            Curl.getVersion(),
          ].join('\n'),
        });
      },
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
        label: `Toggle ${MNEMONIC_SYM}DevTools`,
        accelerator: 'Alt+CmdOrCtrl+I',
        click: () => mainWindow.toggleDevTools(),
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
    ],
  };

  const toolsMenu = {
    label: `${MNEMONIC_SYM}Tools`,
    submenu: [
      {
        label: `${MNEMONIC_SYM}Reload Plugins`,
        accelerator: 'CmdOrCtrl+Shift+R',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          window.webContents.send('reload-plugins');
        },
      },
    ],
  };

  let template = [];

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

function showUnresponsiveModal() {
  dialog.showMessageBox(
    {
      type: 'info',
      buttons: ['Cancel', 'Reload'],
      defaultId: 1,
      cancelId: 0,
      title: 'Unresponsive',
      message: 'Insomnia has become unresponsive. Do you want to reload?',
    },
    id => {
      if (id === 1) {
        mainWindow.destroy();
        createWindow();
      }
    },
  );
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
