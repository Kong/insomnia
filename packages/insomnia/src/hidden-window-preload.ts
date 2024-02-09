import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

import type { Request } from './models/request';
declare global {
  interface Window {
    bridge: {
      on: (channel: string, listener: (event: any) => void) => () => void;
      requirePolyfill: (module: string) => any;
      onmessage: (listener: (data: any, callback: (result: any) => void) => void) => void;
    };
  }
}
export interface RequestContext {
  request: Request;
  timelinePath: string;
}

const bridge: Window['bridge'] = {
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  requirePolyfill: (moduleName: string) => {
    if (['uuid', 'crypto', 'fs'].includes(moduleName)) {
      return require(moduleName);
    }
    throw Error(`no module is found for "${moduleName}"`);
  },
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
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
