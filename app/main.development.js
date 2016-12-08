import reboot from 'electron-squirrel-startup';
if (reboot) {
  process.exit(0);
}

import raven from 'raven';
import request from 'request';
import path from 'path';
import electron from 'electron';
import * as packageJSON from './package.json';
import LocalStorage from './common/LocalStorage';

// Some useful helpers
const IS_DEV = process.env.INSOMNIA_ENV === 'development';
const IS_MAC = process.platform === 'darwin';
const IS_WINDOWS = process.platform === 'win32';
const IS_LINUX = !IS_MAC && !IS_WINDOWS;

const ravenClient = new raven.Client('https://786e43ae199c4757a9ea4a48a9abd17d@sentry.io/109702', {
  environment: process.env.INSOMNIA_ENV || 'production',
  release: packageJSON.version,
  logger: 'electron.main'
});

if (!IS_DEV) {
  ravenClient.patchGlobal();
}

const {app, dialog, shell, ipcMain, autoUpdater, Menu, BrowserWindow, webContents} = electron;
const {version: appVersion, productName: appName} = packageJSON;

const UPDATE_URLS = {
  // Add `r` param to help cache bust
  darwin: `https://updates.insomnia.rest/builds/check/mac?v=${appVersion}`,
  linux: `https://updates.insomnia.rest/builds/check/linux?v=${appVersion}`,
  win32: `https://downloads.insomnia.rest/win`
};

const DOWNLOAD_URL = 'http://download.insomnia.rest';

let localStorage = null;

let mainWindow = null;
let hasPromptedForUpdates = false;

// Enable this for CSS grid layout :)
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

process.on('uncaughtException', e => {
  if (IS_DEV) {
    console.error(e);
  } else {
    ravenClient.captureError(e, {});
  }
});

autoUpdater.on('error', e => {
  if (IS_DEV) {
    console.error(e);
  } else {
    // Don't report autoUpdater error. They are way too noisy
  }
});

autoUpdater.on('update-not-available', () => {
  console.log('-- Update Not Available --')
});

autoUpdater.on('update-available', () => {
  console.log('-- Update Available --');
});

autoUpdater.on('update-downloaded', (e, releaseNotes, releaseName, releaseDate, updateUrl) => {
  console.log(`-- Update Downloaded ${releaseName} --`);
  showUpdateNotification();
});

function checkForUpdates () {
  if (hasPromptedForUpdates) {
    // We've already prompted for updates. Don't bug the user anymore
    return;
  }

  if (IS_DEV) {
    console.log('-- Skipping update check in Development --');
    return;
  }

  if (IS_LINUX) {
    try {
      request.get(UPDATE_URLS.linux, null, (err, response) => {
        if (err) {
          ravenClient.captureError(err);
          return;
        }

        if (response.statusCode === 200) {
          showDownloadModal(response.body);
        } else {
          // No update available (should be STATUS=204)
        }
      });
    } catch (e) {
      ravenClient.captureException(e);
    }
  } else {
    try {
      autoUpdater.setFeedURL(UPDATE_URLS[process.platform]);
      autoUpdater.checkForUpdates();
    } catch (e) {
      // This will fail in development
    }
  }
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

function showUpdateNotification () {
  if (hasPromptedForUpdates) {
    return;
  }

  const window = BrowserWindow.getFocusedWindow();
  if (!window || !window.webContents) {
    return;
  }

  window.webContents.send('update-available');
  hasPromptedForUpdates = true;
}

function trackEvent (...args) {
  const window = BrowserWindow.getFocusedWindow();
  if (!window || !window.webContents) {
    return;
  }

  window.webContents.send('analytics-track-event', args);
}

function showDownloadModal (version) {
  hasPromptedForUpdates = true;

  dialog.showMessageBox({
    type: 'info',
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Insomnia Update Available',
    message: `Exciting news!\n\nVersion ${version} of Insomnia is now available.\n\n\n~Gregory`
  }, id => {
    if (id === 0) {
      console.log('-- Installing Update --');
      shell.openExternal(DOWNLOAD_URL);
    } else {
      console.log('-- Cancel Update --');
    }
  });
}

ipcMain.on('check-for-updates', () => {
  console.log('-- Checking for Updates --');
  checkForUpdates();
});

function saveBounds () {
  if (!mainWindow) {
    return;
  }

  const fullscreen = mainWindow.isFullScreen();

  // Only save the size if we're not in fullscreen
  if (!fullscreen) {
    localStorage.setItem('bounds', mainWindow.getBounds());
    localStorage.setItem('fullscreen', false);
  } else {
    localStorage.setItem('fullscreen', true);
  }
}

function getBounds () {
  let bounds = {};
  let fullscreen = false;
  try {
    bounds = localStorage.getItem('bounds', {});
    fullscreen = localStorage.getItem('fullscreen', false);
  } catch (e) {
    // This should never happen, but if it does...!
    console.error('Failed to parse window bounds', e);
  }

  return {bounds, fullscreen};
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

// Quit when all windows are closed (except on Mac).
app.on('window-all-closed', () => {
  if (!IS_MAC) {
    app.quit();
  }
});

// Mac-only, when the user clicks the doc icon
app.on('activate', (e, hasVisibleWindows) => {
  // Create a new window when clicking the doc icon if there isn't one open
  if (!hasVisibleWindows) {
    try {
      createWindow()
    } catch (e) {
      // This might happen if 'ready' hasn't fired yet. So we're just going
      // to silence these errors.
      console.log('-- App not ready to "activate" yet --');
    }
  }
});

// When the app is first launched
app.on('ready', () => {
  initLocalStorage();
  createWindow();
  checkForUpdates();
});

function initLocalStorage () {
  const localStoragePath = path.join(app.getPath('userData'), 'localStorage');
  localStorage = new LocalStorage(localStoragePath);
}

function createWindow () {
  const zoomFactor = getZoomFactor();
  const {bounds, fullscreen} = getBounds();
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
    title: appName,
    width: width || 1200,
    height: height || 600,
    minHeight: 500,
    minWidth: 500,
    acceptFirstMouse: true,
    icon: path.resolve(__dirname, 'static/icon.png'),
    webPreferences: {
      zoomFactor: zoomFactor
    }
  });

  let _resizeTimeout = null;
  mainWindow.on('resize', e => {
    saveBounds();

    clearTimeout(_resizeTimeout);
    _resizeTimeout = setTimeout(() => {
      trackEvent('Window', 'Resize');
    }, 1000);
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

  // and load the app.html of the app.
  // TODO: Use path.join for this
  mainWindow.loadURL(`file://${__dirname}/renderer.html`);

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
    trackEvent('Window', 'Close');
  });

  require('electron-context-menu')({});

  var template = [
    {
      label: "Application",
      submenu: [
        {
          label: `About ${appName}`,
          role: 'about',
          visible: IS_MAC
        },
        {
          type: "separator",
          visible: IS_MAC
        },
        {
          label: "Preferences",
          accelerator: "CmdOrCtrl+,",
          click: function (menuItem, window, e) {
            if (!window || !window.webContents) {
              return
            }

            window.webContents.send('toggle-preferences');
            trackEvent('App Menu', 'Preferences');
          }
        },
        {
          label: "Changelog",
          click: function (menuItem, window, e) {
            if (!window || !window.webContents) {
              return
            }

            window.webContents.send('toggle-changelog');
            trackEvent('App Menu', 'Changelog');
          }
        },
        {
          type: "separator",
          visible: IS_MAC
        },
        {
          role: "hide",
          visible: IS_MAC
        },
        {
          role: "hideothers",
          visible: IS_MAC
        },
        {type: "separator"},
        {
          label: "Quit",
          accelerator: "Command+Q",
          click: function () {
            app.quit();
          }
        }
      ]
    },
    {
      label: "Edit",
      submenu: [{
        label: "Undo",
        accelerator: "CmdOrCtrl+Z",
        selector: "undo:"
      }, {
        label: "Redo",
        accelerator: "Shift+CmdOrCtrl+Z",
        selector: "redo:"
      }, {
        type: "separator"
      }, {
        label: "Cut",
        accelerator: "CmdOrCtrl+X",
        selector: "cut:"
      }, {
        label: "Copy",
        accelerator: "CmdOrCtrl+C",
        selector: "copy:"
      }, {
        label: "Paste",
        accelerator: "CmdOrCtrl+V",
        selector: "paste:"
      }, {
        label: "Select All",
        accelerator: "CmdOrCtrl+A",
        selector: "selectAll:"
      }]
    },
    {
      label: "View",
      submenu: [
        {
          role: 'togglefullscreen'
        },
        {
          label: "Actual Size",
          accelerator: "CmdOrCtrl+0",
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
          label: "Zoom In",
          accelerator: IS_MAC ? "CmdOrCtrl+Plus" : "CmdOrCtrl+=",
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
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
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
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+\\",
          click: () => {
            const window = BrowserWindow.getFocusedWindow();
            if (!window || !window.webContents) {
              return;
            }

            window.webContents.send('toggle-sidebar');
            trackEvent('App Menu', 'Toggle Sidebar');
          }
        }
      ]
    }, {
      label: "Window",
      role: "window",
      submenu: [
        {role: 'minimize'},
        ...(IS_MAC ? [{role: 'close'}] : [])
      ]
    }, {
      label: "Help",
      role: "help",
      id: "help",
      submenu: [
        {
          label: "Contact Support",
          click: () => {
            trackEvent('App Menu', 'Contact');
            shell.openExternal('https://insomnia.rest/documentation/support-and-feedback/');
          }
        },
        {
          label: "Insomnia Help",
          accelerator: "CmdOrCtrl+?",
          click: () => {
            trackEvent('App Menu', 'Help');
            shell.openExternal('https://insomnia.rest/documentation');
          }
        }
      ]
    }
  ];

  if (IS_DEV) {
    template.push({
      label: 'Developer',
      position: 'before=help',
      submenu: [{
        label: 'Reload',
        accelerator: 'Command+R',
        click: function () {
          mainWindow.reload();
        }
      }, {
        label: 'Toggle DevTools',
        accelerator: 'Alt+Command+I',
        click: function () {
          mainWindow.toggleDevTools();
        }
      }]
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
