import * as fs from 'node:fs';

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { asyncTasksAllSettled, Collection as CollectionModule, OriginalPromise, ProxiedPromise, RequestContext, resetAsyncTasks, stopMonitorAsyncTasks } from 'insomnia-sdk';

import type { Compression } from './models/response';

export interface HiddenBrowserWindowToMainBridgeAPI {
  requireInterceptor: (module: string) => any;
  onmessage: (listener: (data: any, callback: (result: any) => void) => void) => void;
  curlRequest: (options: any) => Promise<any>;
  readCurlResponse: (options: { bodyPath: string; bodyCompression: Compression }) => Promise<{ body: string; error: string }>;
  setBusy: (busy: boolean) => void;
  writeFile: (logPath: string, logContent: string) => Promise<void>;
  asyncTasksAllSettled: () => Promise<void>;
  resetAsyncTasks: () => void;
  stopMonitorAsyncTasks: () => void;
  Promise: typeof Promise;
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
    } else if (
      [
        // external modules
        'ajv',
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
    } else if (moduleName === 'insomnia-collection' || moduleName === 'postman-collection') {
      return CollectionModule;
    }

    throw Error(`no module is found for "${moduleName}"`);
  },

  curlRequest: options => ipcRenderer.invoke('curlRequest', options),
  readCurlResponse: options => ipcRenderer.invoke('readCurlResponse', options),
  setBusy: busy => ipcRenderer.send('set-hidden-window-busy-status', busy),
  // TODO: following methods are for simulating current behavior of running async tasks
  // in the future, it should be better to keep standard way of handling async tasks to avoid confusion
  writeFile: (logPath: string, logContent: string) => {
    return fs.promises.writeFile(logPath, logContent);
  },
  Promise: OriginalPromise,
  asyncTasksAllSettled,
  stopMonitorAsyncTasks,
  resetAsyncTasks,
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('bridge', bridge);
  contextBridge.exposeInMainWorld('Promise', ProxiedPromise);
} else {
  window.bridge = bridge;
  window.Promise = ProxiedPromise;
}
