import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

import { RequestContext } from './sdk/objects/insomnia';

const bridge: Window['bridge'] = {
  onmessage: listener => {
    const rendererListener = (event: IpcRendererEvent) => {
      const [port] = event.ports;
      console.log('[preload] opened port to insomnia renderer');
      const callback = (result: RequestContext) => port.postMessage(result);
      port.onmessage = event => listener(event.data, callback);
    };
    ipcRenderer.on('renderer-listener', rendererListener);
    return () => ipcRenderer.removeListener('renderer-listener', rendererListener);
  },

  requireInterceptor: (moduleName: string) => {
    if (['uuid', 'fs'].includes(moduleName)) {
      return require(moduleName);
    }
    throw Error(`no module is found for "${moduleName}"`);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
