'use strict';

// Don't npm install this (it breaks). Rely on the global one.
const electron = require('electron');

const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.
const IS_DEV = process.env.NODE_ENV === 'development';
const IS_MAC = process.platform === 'darwin';
var mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  if (!IS_MAC) {
    app.quit();
  }
});

app.on('ready', function () {
  mainWindow = new BrowserWindow({
    width: IS_DEV ? 1600 : 1200,
    height: 800,
    minHeight: 500,
    minWidth: 500,
    acceptFirstMouse: true
    // titleBarStyle: IS_MAC ? 'hidden-inset' : 'default'
  });

// and load the electron.html of the app.
  mainWindow.loadURL(`file://${__dirname}/app/electron.html`);

// Open the DevTools.
  if (IS_DEV) {
    mainWindow.webContents.openDevTools();
  }

// Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});
