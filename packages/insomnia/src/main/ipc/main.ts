import { app, ipcMain } from 'electron';
import { writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

import { authorizeUserInWindow } from '../../network/o-auth-2/misc';
import installPlugin from '../install-plugin';
import { cancelCurlRequest, curlRequest } from '../network/libcurl-promise';

export interface MainBridgeAPI {
  restart: () => void;
  authorizeUserInWindow: typeof authorizeUserInWindow;
  setMenuBarVisibility: (visible: boolean) => void;
  installPlugin: typeof installPlugin;
  writeFile: (options: { path: string; content: string }) => Promise<string>;
  cancelCurlRequest: typeof cancelCurlRequest;
  curlRequest: typeof curlRequest;
  createWebsocketRequest: (parentId: string) => Promise<string>;
  getWebSocketRequestsByParentId: (parentId: string) => Promise<WebSocketRequest[]>;
  open: (options: { url: string }) => void;
  message: (options: { message: string }) => string;
  close: () => string;
  websocketlistener: (channel: string, listener: Function) => void;
}
export function registerMainHandlers() {
  ipcMain.handle('authorizeUserInWindow', (_, options: Parameters<typeof authorizeUserInWindow>[0]) => {
    const { url, urlSuccessRegex, urlFailureRegex, sessionId } = options;
    return authorizeUserInWindow({ url, urlSuccessRegex, urlFailureRegex, sessionId });
  });

  ipcMain.handle('writeFile', async (_, options: { path: string; content: string }) => {
    try {
      await writeFile(options.path, options.content);
      return options.path;
    } catch (err) {
      throw new Error(err);
    }
  });

  ipcMain.handle('curlRequest', (_, options: Parameters<typeof curlRequest>[0]) => {
    return curlRequest(options);
  });

  ipcMain.on('cancelCurlRequest', (_, requestId: string): void => {
    cancelCurlRequest(requestId);
  });

  ipcMain.handle('installPlugin', (_, lookupName: string) => {
    return installPlugin(lookupName);
  });
  ipcMain.on('restart', () => {
    app.relaunch();
    app.exit();
  });

  setupWebSockets();
}

interface WebSocketRequest {
  _id: string;
  parentId: string;
  name: string;
  url?: string;
}
function setupWebSockets() {
  // TODO: make it a list, and persist somewhere
  let temporaryOpenConnectionHack: WebSocket;
  // TODO: persist somewhere
  const websocketsRequests: WebSocketRequest[] = [];

  ipcMain.handle('createWebsocketRequest', (_, parentId: string) => {
    // TODO: figure out what to do with this
    // const request = await models.request.create({
    //   parentId,
    //   method: METHOD_GET,
    //   name: 'New Request',
    // });
    const requestId = websocketsRequests.push({ _id: uuidv4(), parentId, name: 'New Request' });
    return requestId;
  });

  ipcMain.handle('getWebSocketRequestsByParentId', (_, parentId: string) => {
    return websocketsRequests.filter(request => request.parentId === parentId);
  });
  ipcMain.on('websocket.open', (event, options: { url: string }) => {
    console.log('Connecting to ' + options.url);
    try {
      const ws = new WebSocket(options.url);
      ws.on('open', () => {
        temporaryOpenConnectionHack = ws;

        event.sender.send('websocket.response', 'Connected to ' + options.url);
        ws.send('remove this test message');
      });
      ws.on('message', buffer => {
        event.sender.send('websocket.response', buffer.toString());
      });

    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.handle('websocket.message', (_, options: { message: string }) => {
    if (!temporaryOpenConnectionHack) {
      return;
    }
    const ws = temporaryOpenConnectionHack;
    ws.send(options.message);
    console.log('sent: ' + options.message);
    return 'sent: ' + options.message;
  });

  ipcMain.handle('websocket.close', () => {
    if (!temporaryOpenConnectionHack) {
      return;
    }
    const ws = temporaryOpenConnectionHack;
    ws.close();
    ws.on('close', () => {
      console.log('Disconnected from ', ws.url);
    });
    return 'success';
  });
}
