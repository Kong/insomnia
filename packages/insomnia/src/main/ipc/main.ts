import { type IpcRendererEvent, app, ipcMain } from 'electron';
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
  createWebsocketRequest: (options: { workspaceId: string }) => Promise<string>;
  getWebSocketRequestsByParentId: (options: { workspaceId: string }) => Promise<WebSocketRequest[]>;
  open: (options: { url: string; requestId: string }) => void;
  message: (options: { message: string; requestId: string }) => void;
  close: (options: { requestId: string }) => void;
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => void;
  getWebSocketConnectionStatus: (options: { requestId: string }) => Promise<boolean>;
  getWebSocketEventLog: (options: { requestId: string }) => Promise<EventLog>;
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

export interface WebSocketRequest {
  _id: string;
  workspaceId: string;
  name: string;
  url?: string;
}
export type EventLog = ReturnType<typeof makeNewEvent>[];
const makeNewEvent = (message: string, requestId: string, type: 'OUTGOING' | 'INCOMING' | 'INFO') => {
  return {
    _id: uuidv4(),
    createdAt: new Date().toISOString(),
    message,
    requestId,
    type,
  };
};

function setupWebSockets() {
  // volatile state, later persist event logs
  const WebSocketInstances = new Map<string, WebSocket>();
  const WebSocketEventLog = new Map<string, EventLog>();
  // TODO: persist somewhere
  // TODO: Limit the active connections to a certain number
  const websocketsRequests: WebSocketRequest[] = [];

  ipcMain.handle('createWebsocketRequest', (_, options: { workspaceId: string }) => {
    // TODO: figure out what to do with this
    // const request = await models.request.create({
    //   parentId,
    //   method: METHOD_GET,
    //   name: 'New Request',
    // });
    const requestId = websocketsRequests.push({ _id: uuidv4(), workspaceId: options.workspaceId, name: 'New Request' });
    return requestId;
  });

  ipcMain.handle('getWebSocketRequestsByParentId', (_, options: { workspaceId: string }) => {
    return websocketsRequests.filter(request => request.workspaceId === options.workspaceId);
  });

  ipcMain.handle('getWebSocketConnectionStatus', (_, options: { requestId: string }) => {
    return !!WebSocketInstances.get(options.requestId);
  });

  ipcMain.handle('getWebSocketEventLog', (_, options: { requestId: string }) => {
    return WebSocketEventLog.get(options.requestId) || [];
  });

  ipcMain.on('websocket.open', (event, options: { url: string; requestId: string }) => {
    console.log('Connecting to ' + options.url);
    try {
      const ws = new WebSocket(options.url);
      WebSocketInstances.set(options.requestId, ws);
      ws.on('open', () => {
        const lastMessage = makeNewEvent('Connected to ' + options.url, options.requestId, 'INFO');
        WebSocketEventLog.set(options.requestId, [lastMessage]);
        event.sender.send('websocket.log', lastMessage);
      });
      ws.on('message', buffer => {
        const msgs = WebSocketEventLog.get(options.requestId) || [];
        const lastMessage = makeNewEvent(buffer.toString().slice(0, 50), options.requestId, 'INCOMING');
        WebSocketEventLog.set(options.requestId, [...msgs, lastMessage]);
        event.sender.send('websocket.log', lastMessage);
      });
      ws.on('close', () => {
        console.log('Disconnected from ', options.url);
        const msgs = WebSocketEventLog.get(options.requestId) || [];
        const lastMessage = makeNewEvent('Disconnected from ' + options.url, options.requestId, 'INFO');
        WebSocketEventLog.set(options.requestId, [...msgs, lastMessage]);
        event.sender.send('websocket.log', lastMessage);
        WebSocketInstances.delete(options.requestId);
      });
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.on('websocket.message', (event, options: { message: string; requestId: string }) => {
    const ws = WebSocketInstances.get(options.requestId);
    if (ws) {
      ws.send(options.message);
      const msgs = WebSocketEventLog.get(options.requestId) || [];
      const lastMessage = makeNewEvent(options.message, options.requestId, 'OUTGOING');
      WebSocketEventLog.set(options.requestId, [...msgs, lastMessage]);
      event.sender.send('websocket.log', lastMessage);
    } else {
      console.warn('No websocket found for requestId: ' + options.requestId);
    }
  });

  ipcMain.on('websocket.close', (_, options: { requestId: string }) => {
    const ws = WebSocketInstances.get(options.requestId);
    if (ws) {
      ws.close();
    } else {
      console.warn('No websocket found for requestId: ' + options.requestId);
    }
  });
}
