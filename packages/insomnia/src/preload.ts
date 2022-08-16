import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

import type { WebsocketEvent, WebsocketInstanceArgs } from './main/network/websocket';

const webSocketConnection = {
  create: (options: {
    requestId: string;
    args: WebsocketInstanceArgs;
  }) => {
    return ipcRenderer.invoke('webSocketRequest.connection.create', options);
  },
  close: (options: { requestId: string }) => {
    return ipcRenderer.invoke('webSocketRequest.connection.close', options);
  },
  readyState: {
    getCurrent: (options: { requestId: string }) => {
      return ipcRenderer.invoke('webSocketRequest.connection.readyState', options);
    },
    subscribe: (
      options: { requestId: string },
      listener: (readyState: WebSocket['readyState']) => any
    ) => {
      const channel = `webSocketRequest.connection.${options.requestId}.readyState`;

      function onReadyStateChange(_event: IpcRendererEvent, readyState: WebSocket['readyState']) {
        listener(readyState);
      }

      ipcRenderer.on(channel, onReadyStateChange);

      const unsubscribe = () => {
        ipcRenderer.off(channel, onReadyStateChange);
      };

      return unsubscribe;
    },
  },
  event: {
    findMany: (options: {
      requestId: string;
    }): Promise<WebsocketEvent[]> => {
      return ipcRenderer.invoke(
        'webSocketRequest.connection.event.findMany',
        options
      );
    },
    subscribe: (
      options: { requestId: string },
      listener: (webSocketEvent: WebsocketEvent) => any
    ) => {
      const channel = `webSocketRequest.connection.${options.requestId}.event`;

      function onNewEvent(_event: IpcRendererEvent, webSocketEvent: WebsocketEvent) {
        listener(webSocketEvent);
      }

      ipcRenderer.on(channel, onNewEvent);

      const unsubscribe = () => {
        ipcRenderer.off(channel, onNewEvent);
      };

      return unsubscribe;
    },
    send(options: { requestId: string; message: string | Blob | ArrayBufferLike | ArrayBufferView }) {
      return ipcRenderer.invoke(
        'webSocketRequest.connection.event.send',
        options
      );
    },
  },
};

export type WSConnection = typeof webSocketConnection; // using 'WS' because main/network/websocket.ts already has WebSocketConnection reserved.
const main: Window['main'] & { webSocketConnection: WSConnection } = {
  restart: () => ipcRenderer.send('restart'),
  authorizeUserInWindow: options => ipcRenderer.invoke('authorizeUserInWindow', options),
  setMenuBarVisibility: options => ipcRenderer.send('setMenuBarVisibility', options),
  installPlugin: options => ipcRenderer.invoke('installPlugin', options),
  curlRequest: options => ipcRenderer.invoke('curlRequest', options),
  cancelCurlRequest: options => ipcRenderer.send('cancelCurlRequest', options),
  writeFile: options => ipcRenderer.invoke('writeFile', options),
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  webSocketConnection,
};
const dialog: Window['dialog'] = {
  showOpenDialog: options => ipcRenderer.invoke('showOpenDialog', options),
  showSaveDialog: options => ipcRenderer.invoke('showSaveDialog', options),
};
const app: Window['app'] = {
  getPath: options => ipcRenderer.sendSync('getPath', options),
  getAppPath: () => ipcRenderer.sendSync('getAppPath'),
};
const shell: Window['shell'] = {
  showItemInFolder: options => ipcRenderer.send('showItemInFolder', options),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('main', main);
  contextBridge.exposeInMainWorld('dialog', dialog);
  contextBridge.exposeInMainWorld('app', app);
  contextBridge.exposeInMainWorld('shell', shell);
} else {
  window.main = main;
  window.dialog = dialog;
  window.app = app;
  window.shell = shell;
}
