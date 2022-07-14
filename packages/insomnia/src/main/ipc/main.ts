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
  message: (options: { message: string; connectionId: string }) => string;
  close: (options: { connectionId: string }) => string;
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => void;
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
  connection?: {
    _id: string;
    connected: boolean;
    messages: ReturnType<typeof makeNewMessage>[];
  };
}

const makeNewMessage = (message: string, connectionId: string, type: 'UP' | 'DOWN' | 'INFO') => {
  return {
    _id: uuidv4(),
    createdAt: new Date().toISOString(),
    message,
    connectionId,
    type,
  };
};

function setupWebSockets() {
  const WebSockets = new Map<string, WebSocket>();
  // TODO: persist somewhere
  // TODO: Limit the active connections to a certain number
  let websocketsRequests: WebSocketRequest[] = [];

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

  ipcMain.on('websocket.open', (event, options: { url: string; requestId: string }) => {
    console.log('Connecting to ' + options.url);
    try {
      const ws = new WebSocket(options.url);
      const connectionId = uuidv4();
      WebSockets.set(connectionId, ws);
      ws.on('open', () => {
        websocketsRequests = websocketsRequests.map(request => {
          if (request._id === options.requestId) {
            return {
              ...request,
              connection: {
                _id: connectionId,
                connected: true,
                messages: [makeNewMessage('Connected to ' + options.url, connectionId, 'INFO')],
              },
            };
          }

          return request;
        });
        ws.send('remove this test message');
      });

      ws.on('message', buffer => {
        websocketsRequests = websocketsRequests.map(request => {
          if (request._id === options.requestId) {
            if (!request.connection) {
              throw new Error('No connection for request ' + options.requestId);
            }
            return {
              ...request,
              connection: {
                _id: connectionId,
                connected: true,
                messages: [...request.connection.messages, makeNewMessage(buffer.toString(), connectionId, 'DOWN')],
              },
            };
          }

          return request;
        });
        // event.sender.send('websocket.response', makeNewMessage(buffer.toString(), connectionId, 'UP'));
      });

      ws.on('close', () => {
        console.log('Disconnected from ', options.url);
        websocketsRequests = websocketsRequests.map(request => {
          if (request._id === options.requestId && request.connection) {
            return {
              ...request,
              connection: {
                _id: request.connection._id,
                connected: false,
                messages: [...request.connection.messages, makeNewMessage('Disconnected from ' + options.url, connectionId, 'INFO')],
              },
            };
          }

          return request;
        });

        // clean up the websocket reference
        WebSockets.delete(connectionId);
      });

    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.handle('websocket.message', (_, options: { message: string; connectionId: string }) => {
    const ws = WebSockets.get(options.connectionId);
    if (ws) {
      websocketsRequests = websocketsRequests.map(request => {
        if (request.connection?._id === options.connectionId) {
          if (!request.connection) {
            throw new Error('No connection for request ' + options.connectionId);
          }
          return {
            ...request,
            connection: {
              _id: request.connection._id,
              connected: true,
              messages: [...request.connection.messages, makeNewMessage(options.message, request.connection._id, 'UP')],
            },
          };
        }

        return request;
      });
      ws.send(options.message);
      console.log('sent: ' + options.message);
    } else {
      console.warn('No websocket found for requestId: ' + options.connectionId);
    }
  });

  ipcMain.handle('websocket.close', (_, options: { connectionId: string }) => {
    const ws = WebSockets.get(options.connectionId);
    if (ws) {
      ws.close();
    } else {
      console.warn('No websocket found for requestId: ' + options.connectionId);
    }
  });
}
