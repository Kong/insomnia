'use strict';

if (require('electron-squirrel-startup')) {
  process.exit(0);
}

var raven = require('raven');
var ravenClient = new raven.Client(
  'https://fb3242f902b54cdd934b8ffa204426c0:23430fbe203a' +
  '4189a68efb63c38fc50b@app.getsentry.com/88289', {
    environment: process.env.INSOMNIA_ENV || 'production',
    release: require('./app.json').version,
  });

if (!IS_DEV) {
  ravenClient.patchGlobal();
}

// Don't npm install this (it breaks). Rely on the global one.
const electron = require('electron');
const request = require('request');
const path = require('path');
const {version: appVersion, productName: appName} = require('./app.json');
const {LocalStorage} = require('node-localstorage');
const {
  app,
  dialog,
  shell,
  ipcMain,
  autoUpdater,
  Menu,
  BrowserWindow,
  webContents
} = electron;

const IS_DEV = process.env.INSOMNIA_ENV === 'development';
const IS_MAC = process.platform === 'darwin';
const IS_WINDOWS = process.platform === 'win32';
const IS_LINUX = !IS_MAC && !IS_WINDOWS;

const UPDATE_URLS = {
  darwin: `https://updates.insomnia.rest/builds/check/mac?v=${appVersion}`,
  win32: 'https://s3.amazonaws.com/builds-insomnia-rest/win',
  linux: `https://updates.insomnia.rest/builds/check/linux?v=${appVersion}`
};

const DOWNLOAD_URL = 'http://download.insomnia.rest';

let mainWindow = null;
let localStorage = null;
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
  // Failed to launch auto updater
  if (IS_DEV) {
    console.error(e);
  } else {
    ravenClient.captureError(e, {});
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
  showUpdateModal();
});

function checkForUpdates () {
  if (IS_DEV) {
    console.log('Skipping update check in Development');
    return;
  }

  if (hasPromptedForUpdates) {
    // We've already prompted for updates. Don't bug the user anymore
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
    buttons: [
      'Cancel',
      'Reload',
    ],
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

function showUpdateModal () {
  hasPromptedForUpdates = true;

  dialog.showMessageBox({
    type: 'info',
    buttons: [
      'Install and Restart',
      'Later',
    ],
    defaultId: 0,
    cancelId: 1,
    title: 'Insomnia Update Available',
    message: 'Exciting news!\n\nA new version of Insomnia has been downloaded and is ready to install\n\n\n~Gregory'
  }, id => {
    if (id === 0) {
      console.log('-- Installing Update --');
      autoUpdater.quitAndInstall();
    } else {
      console.log('-- Cancel Update --');
    }
  });
}

function showDownloadModal (version) {
  hasPromptedForUpdates = true;

  dialog.showMessageBox({
    type: 'info',
    buttons: [
      'Download',
      'Later',
    ],
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
  const fullscreen = mainWindow.isFullScreen();
  if (!fullscreen) {
    // Only save the size if we're not in fullscreen
    localStorage.setItem('bounds', JSON.stringify(mainWindow.getBounds()));
  }

  localStorage.setItem('fullscreen', JSON.stringify(mainWindow.isFullScreen()));
}

function getBounds () {
  let bounds = {};
  let fullscreen = false;
  try {
    bounds = JSON.parse(localStorage.getItem('bounds') || '{}');
    fullscreen = JSON.parse(localStorage.getItem('fullscreen') || 'false')
  } catch (e) {
    // This should never happen, but if it does...!
    console.error('Failed to parse window bounds', e);
  }

  return {bounds, fullscreen};
}

function saveZoomFactor (zoomFactor) {
  localStorage.setItem('zoomFactor', JSON.stringify(zoomFactor));
}

function getZoomFactor () {
  let zoomFactor = 1;
  try {
    zoomFactor = JSON.parse(localStorage.getItem('zoomFactor') || '1');
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
  if (!hasVisibleWindows) {
    createWindow()
  }
});

// When the app is first launched
app.on('ready', () => {
  checkForUpdates();
  createWindow();
});

function createWindow () {
  localStorage = new LocalStorage(path.join(app.getPath('userData'), 'localStorage'));

  const zoomFactor = getZoomFactor();
  const {bounds, fullscreen} = getBounds();
  const {
    x,
    y,
    width,
    height
  } = bounds;

  mainWindow = new BrowserWindow({
    x: x,
    y: y,
    fullscreen: fullscreen,
    fullscreenable: true,
    title: appName,
    width: width || 1200,
    height: height || 600,
    minHeight: 500,
    minWidth: 500,
    acceptFirstMouse: true,
    webPreferences: {
      zoomFactor: zoomFactor
    }
  });

  mainWindow.on('resize', e => saveBounds());
  mainWindow.on('move', e => saveBounds());
  mainWindow.on('unresponsive', e => showUnresponsiveModal());

  // and load the app.html of the app.
  mainWindow.loadURL(`file://${__dirname}/app.html`);

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
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
            // NOTE: Checking for window because it might be closed
            if (window && window.webContents) {
              window.webContents.send('toggle-preferences');
            }
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
            if (window && window.webContents) {
              const zoomFactor = 1;
              window.webContents.setZoomFactor(zoomFactor);
              saveZoomFactor(zoomFactor);
            }
          }
        },
        {
          label: "Zoom In",
          accelerator: IS_MAC ? "CmdOrCtrl+Plus" : "CmdOrCtrl+=",
          click: () => {
            const window = BrowserWindow.getFocusedWindow();
            if (window && window.webContents) {
              const zoomFactor = Math.min(1.8, getZoomFactor() + 0.1);
              window.webContents.setZoomFactor(zoomFactor);

              saveZoomFactor(zoomFactor);
            }
          }
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => {
            const window = BrowserWindow.getFocusedWindow();
            if (window && window.webContents) {
              const zoomFactor = Math.max(0.5, getZoomFactor() - 0.1);
              window.webContents.setZoomFactor(zoomFactor);
              saveZoomFactor(zoomFactor);
            }
          }
        },
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+\\",
          click: () => {
            const window = BrowserWindow.getFocusedWindow();
            window && window.webContents.send('toggle-sidebar');
          }
        }
      ]
    }, {
      label: "Window",
      role: "window",
      submenu: [
        {
          role: 'minimize'
        },
        {
          role: 'close'
        }
      ]
    }, {
      label: "Help",
      role: "help",
      id: "help",
      submenu: [
        {
          label: "Contact Support",
          click: () => {
            electron.shell.openExternal('mailto:support@insomnia.rest');
          }
        },
        {
          label: "View Documentation",
          accelerator: "CmdOrCtrl+?",
          click: () => {
            electron.shell.openExternal('http://docs.insomnia.rest');
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
