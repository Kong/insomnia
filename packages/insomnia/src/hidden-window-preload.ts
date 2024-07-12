import * as fs from 'node:fs';

import ajv from 'ajv';
import chai from 'chai';
import * as cheerio from 'cheerio';
import cryptojs from 'crypto-js';
import * as csvParseSync from 'csv-parse/sync';
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { asyncTasksAllSettled, Collection as CollectionModule, OriginalPromise, ProxiedPromise, RequestContext, resetAsyncTasks, stopMonitorAsyncTasks } from 'insomnia-sdk';
import lodash from 'lodash';
import moment from 'moment';
import tv4 from 'tv4';
import * as uuid from 'uuid';
import xml2js from 'xml2js';

import type { Compression } from './models/response';

const externalModules = new Map<string, object>([
  ['ajv', ajv],
  ['chai', chai],
  ['cheerio', cheerio],
  ['crypto-js', cryptojs],
  ['csv-parse/lib/sync', csvParseSync],
  ['lodash', lodash],
  ['moment', moment],
  ['tv4', tv4],
  ['uuid', uuid],
  ['xml2js', xml2js],
]);

export interface HiddenBrowserWindowToMainBridgeAPI {
  requireInterceptor: (module: string) => any;
  onmessage: (listener: (data: any, callback: (result: any) => void) => void) => void;
  curlRequest: (options: any) => Promise<any>;
  readCurlResponse: (options: { bodyPath: string; bodyCompression: Compression }) => Promise<{ body: string; error: string }>;
  setBusy: (busy: boolean) => void;
  appendFile: (logPath: string, logContent: string) => Promise<void>;
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
      const externalModule = externalModules.get(moduleName);
      if (!externalModule) {
        throw Error(`no module is found for "${moduleName}"`);
      }
      return externalModule;
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
  appendFile: (logPath: string, logContent: string) => {
    return fs.promises.appendFile(logPath, logContent);
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
