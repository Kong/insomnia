'use strict';

// Don't npm install this (it breaks). Rely on the global one.
const electron = require('electron');
const Menu = require('menu');

const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.
const IS_DEV = process.env.NODE_ENV === 'development';
const IS_MAC = process.platform === 'darwin';
var mainWindow = null;

// Enable this for CSS grid layout :)
electron.app.commandLine.appendSwitch('enable-experimental-web-platform-features');

// Quit when all windows are closed.
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
    acceptFirstMouse: true
    // titleBarStyle: IS_MAC ? 'hidden-inset' : 'default'
  });

  // and load the app.html of the app.
  mainWindow.loadURL(`file://${__dirname}/app.html`);

  // Open the DevTools.
  // if (IS_DEV) {
  //   mainWindow.webContents.openDevTools();
  // }

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  var template = [{
    label: "Application",
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
  }, {
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
  }];

  if (IS_DEV) {
    template.push({
      label: 'View',
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
