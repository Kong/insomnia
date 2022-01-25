const { contextBridge, ipcRenderer } = require('electron');

const main = {
  restart: () => ipcRenderer.send('restart'),
  authorizeUserInWindow: options => ipcRenderer.invoke('authorizeUserInWindow', options),
  setMenuBarVisibility: options => ipcRenderer.send('setMenuBarVisibility', options),
};
const dialog = {
  showOpenDialog: options => ipcRenderer.invoke('showOpenDialog', options),
  showSaveDialog: options => ipcRenderer.invoke('showSaveDialog', options),
};
const app = {
  getPath: options => ipcRenderer.sendSync('getPath', options),
  getAppPath: options => ipcRenderer.sendSync('getAppPath', options),
};
const shell = {
  showItemInFolder: options => ipcRenderer.send('showItemInFolder', options),
};
const net = {
  request: options => ipcRenderer.send('request', options),
};

// if (process.contextIsolated) { TODO: use if rather than try after upgrading to electron 13
try {
  contextBridge.exposeInMainWorld('main', main);
  contextBridge.exposeInMainWorld('dialog', dialog);
  contextBridge.exposeInMainWorld('app', app);
  contextBridge.exposeInMainWorld('shell', shell);
  contextBridge.exposeInMainWorld('net', net);
} catch {
  window.main = main;
  window.dialog = dialog;
  window.app = app;
  window.shell = shell;
  window.net = net;
}
