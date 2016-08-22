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

ravenClient.patchGlobal();

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
  ipcRenderer,
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

// Enable this for CSS grid layout :)
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

autoUpdater.on('error', e => {
  // Failed to launch auto updater
  ravenClient.captureError(e);
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

function showUpdateModal () {
  dialog.showMessageBox({
    type: 'info',
    buttons: [
      'Install and Restart',
      'Later',
    ],
    defaultId: 0,
    cancelId: 1,
    title: 'New Update Available!',
    message: 'Exciting news!\n\nA fresh new update has been downloaded and is ready to install\n\n\n~Gregory'
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
  dialog.showMessageBox({
    type: 'info',
    buttons: [
      'Download',
      'Later',
    ],
    defaultId: 0,
    cancelId: 1,
    title: 'New Update Available!',
    message: `Exciting news!\n\nVersion ${version} is available.\n\n\n~Gregory`
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
  localStorage.setItem('bounds', JSON.stringify(mainWindow.getBounds()));
}

function getBounds () {
  let bounds = {};
  try {
    bounds = JSON.parse(localStorage.getItem('bounds') || '{}');
  } catch (e) {
    // This should never happen, but if it does...!
    console.error('Failed to parse window bounds', e);
  }

  return bounds;
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

app.on('ready', () => {
  // First, check for updates
  checkForUpdates();

  localStorage = new LocalStorage(path.join(app.getPath('userData'), 'localStorage'));

  const zoomFactor = getZoomFactor();
  const bounds = getBounds();
  const {
    x,
    y,
    width,
    height
  } = bounds;

  mainWindow = new BrowserWindow({
    x: x,
    y: y,
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

  // and load the app.html of the app.
  mainWindow.loadURL(`file://${__dirname}/app.html`);

  if (IS_DEV) {
    BrowserWindow.addDevToolsExtension(
      '/Users/gschier/Library/Application Support/Google/Chrome/Default/' +
      'Extensions/fmkadmapgofadopljbjfkapdkoienihi/0.15.0_0'
    );
  }

  // Uncomment this to test things
  // mainWindow.toggleDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  var template = [];
  if (IS_MAC) {
    template.push({
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
            window.webContents.send('toggle-preferences');
          }
        },
        {type: "separator"},
        {
          role: "hide"
        },
        {
          role: "hideothers"
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
    })
  }

  template = template.concat([{
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
  }, {
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
          const zoomFactor = 1;
          window.webContents.setZoomFactor(zoomFactor);
          saveZoomFactor(zoomFactor);
        }
      },
      {
        label: "Zoom In",
        accelerator: IS_MAC ? "CmdOrCtrl+Plus" : "CmdOrCtrl+=",
        click: () => {
          let zoomFactor = getZoomFactor();
          zoomFactor = Math.min(1.8, zoomFactor + 0.1);

          const window = BrowserWindow.getFocusedWindow();
          window.webContents.setZoomFactor(zoomFactor);

          saveZoomFactor(zoomFactor);
        }
      },
      {
        label: "Zoom Out",
        accelerator: "CmdOrCtrl+-",
        click: () => {
          let zoomFactor = getZoomFactor();
          zoomFactor = Math.max(0.5, zoomFactor - 0.1);

          const window = BrowserWindow.getFocusedWindow();
          window.webContents.setZoomFactor(zoomFactor);

          saveZoomFactor(zoomFactor);
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
        label: "Report an Issue...",
        click: () => {
          electron.shell.openExternal('mailto:support@insomnia.rest');
        }
      },
      {
        label: "Insomnia Help",
        accelerator: "CmdOrCtrl+?",
        click: () => {
          electron.shell.openExternal('http://insomnia.rest');
        }
      }
    ]
  }]);

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
});
