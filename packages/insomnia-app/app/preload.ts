import { contextBridge, ipcRenderer } from 'electron';
const api = {
  getAvailableFonts: () => ipcRenderer.invoke('getAvailableFonts'),
};

// contextIsolationEnabled should be true in a dev and prod env, can use process.contextIsolated in electron 13
const { internalContextBridge } = contextBridge as any;
const { contextIsolationEnabled } = internalContextBridge;

if (contextIsolationEnabled) {
  contextBridge.exposeInMainWorld('api', api);
} else {
  // contextIsolationEnabled should be at false in a testing environment (spectron still relies on node integration and remote module, this else should be removed in the future)
  window.api = api;
}
