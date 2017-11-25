import electron from 'electron';
import path from 'path';
import fs from 'fs';
import LocalStorage from './local-storage';
import {CHANGELOG_BASE_URL, getAppName, getAppVersion, isDevelopment, isMac} from '../common/constants';
import {trackEvent} from '../common/analytics';
import * as misc from '../common/misc';

const {app, Menu, BrowserWindow, shell, dialog} = electron;

const DEFAULT_WIDTH = 1100;
const DEFAULT_HEIGHT = 550;
const MINIMUM_WIDTH = 500;
const MINIMUM_HEIGHT = 400;

let mainWindow = null;
let localStorage = null;

export function init () {
  initLocalStorage();
  initContextMenus();
}

export function createWindow () {
  const zoomFactor = getZoomFactor();
  const {bounds, fullscreen, maximize} = getBounds();
  const {x, y, width, height} = bounds;

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
      zoomFactor: zoomFactor
    }
  });

  // BrowserWindow doesn't have an option for this, so we have to do it manually :(
  if (maximize) {
    mainWindow.maximize();
  }

  let _resizeTimeout = null;
  mainWindow.on('resize', e => {
    saveBounds();

    clearTimeout(_resizeTimeout);
    _resizeTimeout = setTimeout(() => {
      trackEvent('Window', 'Resize');
    }, 1000);
  });

  mainWindow.on('maximize', e => {
    saveBounds();
    trackEvent('Window', 'Maximize');
  });

  mainWindow.on('unmaximize', e => {
    saveBounds();
    trackEvent('Window', 'Unmaximize');
  });

  let _moveTimeout = null;
  mainWindow.on('move', e => {
    saveBounds();

    clearTimeout(_moveTimeout);
    _moveTimeout = setTimeout(() => {
      trackEvent('Window', 'Move');
    }, 1000);
  });

  mainWindow.on('unresponsive', e => {
    showUnresponsiveModal();
    trackEvent('Window', 'Unresponsive');
  });

  // Load the html of the app.
  const appUrl = process.env.APP_RENDER_URL || `file://${__dirname}/renderer.html`;
  console.log(`[main] Loading ${process.env.APP_RENDER_URL}`);
  mainWindow.loadURL(appUrl);

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
    trackEvent('Window', 'Close');
  });

  const applicationMenu = {
    label: 'Application',
    submenu: [
      ...(isMac() ? [
        {label: `About ${getAppName()}`, role: 'about'},
        {type: 'separator'}
      ] : []),
      {
        label: 'Preferences',
        accelerator: 'CmdOrCtrl+,',
        click: function (menuItem, window, e) {
          if (!window || !window.webContents) {
            return;
          }
          window.webContents.send('toggle-preferences');
          trackEvent('App Menu', 'Preferences');
        }
      },
      {
        label: 'Changelog',
        click: function (menuItem, window, e) {
          if (!window || !window.webContents) {
            return;
          }
          misc.clickLink(`${CHANGELOG_BASE_URL}/${getAppVersion()}/`);
          trackEvent('App Menu', 'Changelog');
        }
      },
      ...(isMac() ? [
        {type: 'separator'},
        {role: 'hide'},
        {role: 'hideothers'}
      ] : []),
      {type: 'separator'},
      {label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit()}
    ]
  };

  const editMenu = {
    label: 'Edit',
    submenu: [
      {label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:'},
      {label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:'},
      {type: 'separator'},
      {label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:'},
      {label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:'},
      {label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:'},
      {label: 'Select All', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:'}
    ]
  };

  const viewMenu = {
    label: 'View',
    submenu: [
      {role: 'togglefullscreen'},
      {
        label: 'Actual Size',
        accelerator: 'CmdOrCtrl+0',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          const zoomFactor = 1;
          window.webContents.setZoomFactor(zoomFactor);
          saveZoomFactor(zoomFactor);
          trackEvent('App Menu', 'Zoom Reset');
        }
      },
      {
        label: 'Zoom In',
        accelerator: isMac() ? 'CmdOrCtrl+Plus' : 'CmdOrCtrl+=',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          const zoomFactor = Math.min(1.8, getZoomFactor() + 0.05);
          window.webContents.setZoomFactor(zoomFactor);

          saveZoomFactor(zoomFactor);
          trackEvent('App Menu', 'Zoom In');
        }
      },
      {
        label: 'Zoom Out',
        accelerator: 'CmdOrCtrl+-',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          const zoomFactor = Math.max(0.5, getZoomFactor() - 0.05);
          window.webContents.setZoomFactor(zoomFactor);
          saveZoomFactor(zoomFactor);
          trackEvent('App Menu', 'Zoom Out');
        }
      },
      {
        label: 'Toggle Sidebar',
        accelerator: 'CmdOrCtrl+\\',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          window.webContents.send('toggle-sidebar');
          trackEvent('App Menu', 'Toggle Sidebar');
        }
      },
      {
        label: 'Toggle DevTools',
        click: () => mainWindow.toggleDevTools()
      }
    ]
  };

  const windowMenu = {
    label: 'Window',
    role: 'window',
    submenu: [
      {role: 'minimize'},
      ...(isMac() ? [{role: 'close'}] : [])
    ]
  };

  const helpMenu = {
    label: 'Help',
    role: 'help',
    id: 'help',
    submenu: [
      {
        label: 'Contact Support',
        click: () => {
          trackEvent('App Menu', 'Contact');
          shell.openExternal('https://insomnia.rest/support/');
        }
      },
      {
        label: 'Keyboard Shortcuts',
        click: (menuItem, window, e) => {
          if (!window || !window.webContents) {
            return;
          }
          window.webContents.send('toggle-preferences-shortcuts');
          trackEvent('App Menu', 'Shortcuts');
        }
      },
      {
        label: 'Show App Data Folder',
        click: (menuItem, window, e) => {
          const directory = app.getPath('userData');
          shell.showItemInFolder(directory);
          trackEvent('App Menu', 'Open App Data');
        }
      },
      {
        label: 'Insomnia Help',
        accelerator: 'CmdOrCtrl+/',
        click: () => {
          trackEvent('App Menu', 'Help');
          shell.openExternal('https://support.insomnia.rest');
        }
      }
    ]
  };

  const developerMenu = {
    label: 'Developer',
    position: 'before=help',
    submenu: [{
      label: 'Reload',
      accelerator: 'Shift+F5',
      click: () => mainWindow.reload()
    }, {
      label: 'Toggle DevTools',
      accelerator: 'Alt+CmdOrCtrl+I',
      click: () => mainWindow.toggleDevTools()
    }, {
      label: 'Resize to Default',
      click: () => mainWindow.setBounds({
        x: 100,
        y: 100,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT
      })
    }, {
      label: 'Take Screenshot',
      click: function () {
        mainWindow.capturePage(image => {
          const buffer = image.toPNG();
          const dir = app.getPath('desktop');
          fs.writeFileSync(path.join(dir, `Screenshot-${new Date()}.png`), buffer);
        });
      }
    }]
  };

  const toolsMenu = {
    label: 'Tools',
    submenu: [{
      label: 'Reload Plugins',
      accelerator: 'CmdOrCtrl+Shift+R',
      click: () => {
        const window = BrowserWindow.getFocusedWindow();
        if (!window || !window.webContents) {
          return;
        }

        window.webContents.send('reload-plugins');
      }
    }]
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

function showUnresponsiveModal () {
  dialog.showMessageBox({
    type: 'info',
    buttons: ['Cancel', 'Reload'],
    defaultId: 1,
    cancelId: 0,
    title: 'Unresponsive',
    message: 'Insomnia has become unresponsive. Do you want to reload?'
  }, id => {
    if (id === 1) {
      mainWindow.destroy();
      createWindow();
    }
  });
}

function saveBounds () {
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

function getBounds () {
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

  return {bounds, fullscreen, maximize};
}

function saveZoomFactor (zoomFactor) {
  localStorage.setItem('zoomFactor', zoomFactor);
}

function getZoomFactor () {
  let zoomFactor = 1;
  try {
    zoomFactor = localStorage.getItem('zoomFactor', 1);
  } catch (e) {
    // This should never happen, but if it does...!
    console.error('Failed to parse zoomFactor', e);
  }

  return zoomFactor;
}

function initLocalStorage () {
  const localStoragePath = path.join(app.getPath('userData'), 'localStorage');
  localStorage = new LocalStorage(localStoragePath);
}

function initContextMenus () {
  require('electron-context-menu')({});
}
