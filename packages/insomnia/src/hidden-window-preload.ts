import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

import type { Compression } from './models/response';
import * as CollectionModule from './sdk/objects';
import type { RequestContext } from './sdk/objects/interfaces';

export interface HiddenBrowserWindowToMainBridgeAPI {
  requireInterceptor: (module: string) => any;
  onmessage: (listener: (data: any, callback: (result: any) => void) => void) => void;
  curlRequest: (options: any) => Promise<any>;
  readCurlResponse: (options: { bodyPath: string; bodyCompression: Compression }) => Promise<{ body: string; error: string }>;
  setBusy: (busy: boolean) => void;
}
const bridge: HiddenBrowserWindowToMainBridgeAPI = {
  onmessage: listener => {
    const rendererListener = (event: IpcRendererEvent) => {
      const [port] = event.ports;
      console.log('[preload] opened port to insomnia renderer');
      const callback = (result: RequestContext) => port.postMessage(result);
      port.onmessage = event => listener(event.data, callback);
      ipcRenderer.invoke('hidden-window-received-port');
    };

    ipcRenderer.on('renderer-listener', rendererListener);
    ipcRenderer.invoke('renderer-listener-ready');
    return () => ipcRenderer.removeListener('renderer-listener', rendererListener);
  },

  requireInterceptor: (moduleName: string) => {
    if (
      [
        // node.js modules
        'path',
        'assert',
        'buffer',
        'util',
        'url',
        'punycode',
        'querystring',
        'string_decoder',
        'stream',
        'timers',
        'events',
        // follows should be npm modules
        // but they are moved to here to avoid introducing additional dependencies
      ].includes(moduleName)
    ) {
      return require(moduleName);
    } else if (
      [
        'atob',
        'btoa',
      ].includes(moduleName)
    ) {
      return moduleName === 'atob' ? atob : btoa;
    } else if (moduleName === 'insomnia-collection' || moduleName === 'postman-collection') {
      return CollectionModule;
    }

    throw Error(`no module is found for "${moduleName}"`);
  },

  curlRequest: options => ipcRenderer.invoke('curlRequest', options),
  readCurlResponse: options => ipcRenderer.invoke('readCurlResponse', options),
  setBusy: busy => ipcRenderer.send('set-hidden-window-busy-status', busy),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
