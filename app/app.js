'use strict';

if (require('electron-squirrel-startup')) {
  process.exit(0);
}

// Don't npm install this (it breaks). Rely on the global one.
const electron = require('electron');
const path = require('path');
const appVersion = require('./app.json').version;
const {
  app,
  dialog,
  ipcMain,
  autoUpdater,
  Menu,
  BrowserWindow,
  webContents
} = electron;
const {
  LocalStorage
} = require('node-localstorage');

const IS_DEV = process.env.NODE_ENV === 'development';
const IS_MAC = process.platform === 'darwin';
// const IS_WIN = process.platform === 'win32';
// const IS_LIN = process.platform === 'linux';

const UPDATE_URLS = {
  darwin: `http://updates.insomnia.rest/builds/check/mac?v=${appVersion}`,
  win32: 'https://s3.amazonaws.com/builds-insomnia-rest/win',
  linux: null
};

let mainWindow = null;
let localStorage = null;

// Enable this for CSS grid layout :)
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

if (!IS_DEV) {
  try {
    autoUpdater.setFeedURL(UPDATE_URLS[process.platform]);
    autoUpdater.checkForUpdates();
  } catch (e) {
    // Probably don't have internet
  }
}

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

function showUpdateModal() {
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

ipcMain.on('check-for-updates', () => {
  console.log('-- Checking for Updates --');
  if (!IS_DEV) {
    autoUpdater.checkForUpdates();
  }
});

function saveBounds() {
  localStorage.setItem('bounds', JSON.stringify(mainWindow.getBounds()));
}

function getBounds() {
  let bounds = {};
  try {
    bounds = JSON.parse(localStorage.getItem('bounds') || '{}');
  } catch (e) {
    // This should never happen, but if it does...!
    console.error('Failed to parse window bounds', e);
  }

  return bounds;
}

function saveZoomFactor(zoomFactor) {
  localStorage.setItem('zoomFactor', JSON.stringify(zoomFactor));
}

function getZoomFactor() {
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

  if (process.env.NODE_ENV === 'development') {
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
      role: "window",
      submenu: [{
        label: "About Application",
        selector: "orderFrontStandardAboutPanel:"
      }, {
        type: "separator"
      }, {
        label: "Quit",
        accelerator: "Command+Q",
        click: function() {
          app.quit();
        }
      }]
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
    role: "window",
    submenu: [{
      label: "Actual Size",
      accelerator: "CmdOrCtrl+0",
      click: () => {
        const window = BrowserWindow.getFocusedWindow();
        const zoomFactor = 1;
        window.webContents.setZoomFactor(zoomFactor);
        saveZoomFactor(zoomFactor);
      }
    }, {
      label: "Zoom In",
      accelerator: IS_MAC ? "CmdOrCtrl+Plus" : "CmdOrCtrl+=",
      click: () => {
        let zoomFactor = getZoomFactor();
        zoomFactor = Math.min(1.8, zoomFactor + 0.1);

        const window = BrowserWindow.getFocusedWindow();
        window.webContents.setZoomFactor(zoomFactor);

        saveZoomFactor(zoomFactor);
      }
    }, {
      label: "Zoom Out",
      accelerator: "CmdOrCtrl+-",
      click: () => {
        let zoomFactor = getZoomFactor();
        zoomFactor = Math.max(0.5, zoomFactor - 0.1);

        const window = BrowserWindow.getFocusedWindow();
        window.webContents.setZoomFactor(zoomFactor);

        saveZoomFactor(zoomFactor);
      }
    }]
  }, {
    label: "Help",
    role: "help",
    id: "help",
    submenu: [{
      label: "Report an Issue...",
      click: () => {
        electron.shell.openExternal('mailto:support@insomnia.rest');
      }
    }, {
      label: "Insomnia Help",
      accelerator: "CmdOrCtrl+?",
      click: () => {
        electron.shell.openExternal('http://insomnia.rest');
      }
    }]
  }]);

  if (IS_DEV) {
    template.push({
      label: 'Developer',
      position: 'before=help',
      submenu: [{
        label: 'Reload',
        accelerator: 'Command+R',
        click: function() {
          mainWindow.reload();
        }
      }, {
        label: 'Toggle DevTools',
        accelerator: 'Alt+Command+I',
        click: function() {
          mainWindow.toggleDevTools();
        }
      }]
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
});
