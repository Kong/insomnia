import { contextBridge, ipcRenderer } from 'electron';
const requirePolyfill = (moduleName: string) => {
  if (['uuid', 'crypto', 'fs'].includes(moduleName)) {
    return require(moduleName);
  }
  throw Error(`no module is found for "${moduleName}"`);
};

const bridge: Window['bridge'] = {
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  requirePolyfill,
};
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
