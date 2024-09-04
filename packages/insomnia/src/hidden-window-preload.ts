import * as fs from 'node:fs';

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { asyncTasksAllSettled, OriginalPromise, ProxiedPromise, type RequestContext, resetAsyncTasks, stopMonitorAsyncTasks } from 'insomnia-sdk';

import type { Compression } from './models/response';
// this will also import lots of node_modules into the preload script, consider moving this file insomnia-sdk
import { requireInterceptor } from './requireInterceptor';

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
  requireInterceptor,
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
