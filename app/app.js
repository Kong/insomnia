'use strict';

if (require('electron-squirrel-startup')) {
  process.exit(0);
}

// Don't npm install this (it breaks). Rely on the global one.
const electron = require('electron');
const appVersion = require('./app.json').version;
const {app, dialog, ipcMain, autoUpdater, Menu, BrowserWindow, webContents} = electron;

const IS_DEV = process.env.NODE_ENV === 'development';
const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';
const IS_LIN = process.platform === 'linux';

const UPDATE_URLS = {
  darwin: `http://updates.insomnia.rest/builds/check/mac?v=${appVersion}`,
  win32: 'https://s3.amazonaws.com/builds-insomnia-rest/win',
  linux: null
};

let mainWindow = null;
let zoomFactor = 1;

// Enable this for CSS grid layout :)
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

if (!IS_DEV) {
  autoUpdater.setFeedURL(UPDATE_URLS[process.platform]);
  autoUpdater.checkForUpdates();
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

ipcMain.on('check-for-updates', () => {
  console.log('-- Checking for Updates --');
  if (!IS_DEV) {
    autoUpdater.checkForUpdates();
  }
});

// Quit when all windows are closed (except on Mac).
app.on('window-all-closed', () => {
  if (!IS_MAC) {
    app.quit();
  }
});

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 600,
    minHeight: 500,
    minWidth: 500,
    acceptFirstMouse: true,
    webPreferences: {
      zoomFactor: zoomFactor
    }
  });

  // and load the app.html of the app.
  mainWindow.loadURL(`file://${__dirname}/app.html`);

  // Uncomment this to test things
  // mainWindow.toggleDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  var template = [
    {
      label: "Application",
      role: "window",
      submenu: [
        {label: "About Application", selector: "orderFrontStandardAboutPanel:"},
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
      submenu: [
        {label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:"},
        {label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:"},
        {type: "separator"},
        {label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:"},
        {label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:"},
        {label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:"},
        {label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:"}
      ]
    },
    {
      label: "View",
      role: "window",
      submenu: [
        {
          label: "Actual Size",
          accelerator: "CmdOrCtrl+0",
          click: () => {
            const window = electron.BrowserWindow.getFocusedWindow();
            zoomFactor = 1;
            window.webContents.setZoomFactor(zoomFactor);
          }
        },
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+Plus",
          click: () => {
            const window = electron.BrowserWindow.getFocusedWindow();
            zoomFactor = Math.min(1.8, zoomFactor + 0.1);
            window.webContents.setZoomFactor(zoomFactor);
          }
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => {
            const window = electron.BrowserWindow.getFocusedWindow();
            zoomFactor = Math.max(0.5, zoomFactor - 0.1);
            window.webContents.setZoomFactor(zoomFactor);
          }
        }
      ]
    },
    {
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

  if (!IS_WIN) {
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }
});
