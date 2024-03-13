import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

import * as CollectionModule from './sdk/objects';
import { RequestContext } from './sdk/objects/interfaces';

const bridge: Window['bridge'] = {
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
        'fs',
        // npm modules
        'uuid',
        // 'ajv',
        // 'atob',
        // 'btoa',
        // 'chai',
        // 'cheerio',
        // 'crypto-js',
        // 'csv-parse/lib/sync',
        // 'lodash',
        // 'moment',
        // 'tv4',
        // 'uuid',
        // 'xml2js',
      ].includes(moduleName)
    ) {
      return require(moduleName);
    } else if (moduleName === 'insomnia-collection' || moduleName === 'postman-collection') {
      return CollectionModule;
    }

    throw Error(`no module is found for "${moduleName}"`);
  },

  curlRequest: options => ipcRenderer.invoke('curlRequest', options),
  cancelCurlRequest: options => ipcRenderer.send('cancelCurlRequest', options),
  readCurlResponse: options => ipcRenderer.invoke('readCurlResponse', options),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
} else {
  window.bridge = bridge;
}
