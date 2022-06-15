const { contextBridge, ipcRenderer } = require('electron');

const main = {
  restart: () => ipcRenderer.send('restart'),
  authorizeUserInWindow: (/** @type {any} */ options) => ipcRenderer.invoke('authorizeUserInWindow', options),
  setMenuBarVisibility: (/** @type {any} */ options) => ipcRenderer.send('setMenuBarVisibility', options),
  installPlugin: (/** @type {any} */ options) => ipcRenderer.invoke('installPlugin', options),
  curlRequest: (/** @type {any} */ options) => ipcRenderer.invoke('curlRequest', options),
  cancelCurlRequest: (/** @type {any} */ options) => ipcRenderer.send('cancelCurlRequest', options),
  writeFile: (/** @type {any} */ options) => ipcRenderer.invoke('writeFile', options),
};
const dialog = {
  showOpenDialog: (/** @type {any} */ options) => ipcRenderer.invoke('showOpenDialog', options),
  showSaveDialog: (/** @type {any} */ options) => ipcRenderer.invoke('showSaveDialog', options),
};
const app = {
  getPath: (/** @type {any} */ options) => ipcRenderer.sendSync('getPath', options),
  getAppPath: (/** @type {any} */ options) => ipcRenderer.sendSync('getAppPath', options),
};
const shell = {
  showItemInFolder: (/** @type {any} */ options) => ipcRenderer.send('showItemInFolder', options),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('main', main);
  contextBridge.exposeInMainWorld('dialog', dialog);
  contextBridge.exposeInMainWorld('app', app);
  contextBridge.exposeInMainWorld('shell', shell);
} else {
  window.main = main;
  window.dialog = dialog;
  window.app = app;
  window.shell = shell;
}
