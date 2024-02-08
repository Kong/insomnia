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
  onmessage: listener => {
    ipcRenderer.on('renderer-listener', (event: MessageEvent) => {
      const [port] = event.ports;
      console.log('[preload] opened port to insomnia renderer');
      const callback = result => port.postMessage(result);
      port.onmessage = event => listener(event.data, callback);
    });
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
