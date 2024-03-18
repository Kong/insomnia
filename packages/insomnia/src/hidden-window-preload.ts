import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

import type { Compression } from './models/response';
import * as CollectionModule from './sdk/objects';
import type { RequestContext } from './sdk/objects/interfaces';

export interface HiddenBrowserWindowToMainBridgeAPI {
  requireInterceptor: (module: string) => any;
  onmessage: (listener: (data: any, callback: (result: any) => void) => void) => void;
  curlRequest: (options: any) => Promise<any>;
  readCurlResponse: (options: { bodyPath: string; bodyCompression: Compression }) => Promise<{ body: string; error: string }>;
}
const bridge: HiddenBrowserWindowToMainBridgeAPI = {
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
      ].includes(moduleName)
    ) {
      return require(moduleName);
    } else if (
      [
        // npm modules
        'atob',
        'btoa',
        'chai',
        'cheerio',
        'crypto-js',
        'csv-parse/lib/sync',
        'lodash',
        'moment',
        'tv4',
        'uuid',
        'xml2js',
      ].includes(moduleName)
    ) {
      if (moduleName === 'csv-parse/lib/sync') {
        return require('csv-parse/sync');
      }
      return require(moduleName);
    } if (moduleName === 'insomnia-collection' || moduleName === 'postman-collection') {
      return CollectionModule;
    } else if (moduleName === '__fs') {
      // this is one additional module which is required by internal impplementation
      // TODO: ideally it should be disabled
      return require('fs');
    }

    throw Error(`no module is found for "${moduleName}"`);
  },

  curlRequest: options => ipcRenderer.invoke('curlRequest', options),
  readCurlResponse: options => ipcRenderer.invoke('readCurlResponse', options),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
