const { contextBridge, ipcRenderer } = require('electron');

const main = {
  restart: () => ipcRenderer.send('restart'),
  authorizeUserInWindow: options => ipcRenderer.invoke('authorizeUserInWindow', options),
  setMenuBarVisibility: options => ipcRenderer.send('setMenuBarVisibility', options),
  installPlugin: options => ipcRenderer.invoke('installPlugin', options),
  curlRequest: options => ipcRenderer.invoke('curlRequest', options),
  cancelCurlRequest: options => ipcRenderer.send('cancelCurlRequest', options),
  writeFile: options => ipcRenderer.invoke('writeFile', options),
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

// if (process.contextIsolated) { TODO: use if rather than try after upgrading to electron 13
try {
  contextBridge.exposeInMainWorld('main', main);
  contextBridge.exposeInMainWorld('dialog', dialog);
  contextBridge.exposeInMainWorld('app', app);
  contextBridge.exposeInMainWorld('shell', shell);
} catch {
  window.main = main;
  window.dialog = dialog;
  window.app = app;
  window.shell = shell;
}
