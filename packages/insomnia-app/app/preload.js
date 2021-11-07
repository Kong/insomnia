const { contextBridge, ipcRenderer } = require('electron');

try {
  // assume contextIsolation=true
  contextBridge.exposeInMainWorld('main', {
    getAvailableFonts: () => ipcRenderer.invoke('getAvailableFonts'),
  });

} catch (e) {}

// expose for other preload scripts to use, this also covers contextIsolation=false
window.main = window.main || {};
window.main.getAvailableFonts = () => ipcRenderer.invoke('getAvailableFonts');
