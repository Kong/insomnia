const { contextBridge, ipcRenderer } = require('electron');

try {
  // assume contextIsolation=true
  contextBridge.exposeInMainWorld('main', {
    getAvailableFonts: () => ipcRenderer.invoke('getAvailableFonts'),
  });
  contextBridge.exposeInMainWorld('dialog', {
    showOpenDialog: options => ipcRenderer.invoke('showOpenDialog', options),
    showSaveDialog: options => ipcRenderer.invoke('showSaveDialog', options),
  });
  contextBridge.exposeInMainWorld('app', {
    getPath: options => ipcRenderer.sendSync('getPath', options),
  });
  contextBridge.exposeInMainWorld('shell', {
    showItemInFolder: options => ipcRenderer.invoke('showItemInFolder', options),
  });

} catch (e) {}

// expose for other preload scripts to use, this also covers contextIsolation=false
window.main = window.main || {};
window.main.getAvailableFonts = () => ipcRenderer.invoke('getAvailableFonts');
window.dialog = window.dialog || {};
window.dialog.showOpenDialog = options => ipcRenderer.invoke('showOpenDialog', options);
window.dialog.showSaveDialog = options => ipcRenderer.invoke('showSaveDialog', options);
window.app = window.app || {};
window.app.getPath = options => ipcRenderer.sendSync('getPath', options);
window.shell = window.shell || {};
window.shell.showItemInFolder = options => ipcRenderer.invoke('showItemInFolder', options);
