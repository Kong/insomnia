import electron, { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { io as SocketIOClient, Socket } from 'socket.io-client';
import { v4 as uuidV4 } from 'uuid';
import {
  type CloseEvent,
  type ErrorEvent,
  type Event,
  type MessageEvent,
  WebSocket,
} from 'ws';

import { generateId } from '../../common/misc';
import { socketIORequest } from '../../models';
import type { CookieJar } from '../../models/cookie-jar';
import { type RequestHeader } from '../../models/request';
import type { BaseWebSocketRequest } from '../../models/websocket-request';
import { ipcMainHandle, ipcMainOn } from '../ipc/electron';

export interface WebSocketConnection extends WebSocket {
  _id: string;
  requestId: string;
}

export type WebSocketOpenEvent = Omit<Event, 'target'> & {
  _id: string;
  requestId: string;
  type: 'open';
  timestamp: number;
};

export type WebSocketMessageEvent = Omit<MessageEvent, 'target'> & {
  _id: string;
  requestId: string;
  direction: 'OUTGOING' | 'INCOMING';
  type: 'message';
  timestamp: number;
};

export type WebSocketErrorEvent = Omit<ErrorEvent, 'target'> & {
  _id: string;
  requestId: string;
  type: 'error';
  timestamp: number;
};

export type WebSocketCloseEvent = Omit<CloseEvent, 'target'> & {
  _id: string;
  requestId: string;
  type: 'close';
  timestamp: number;
};

export type WebSocketEvent =
  | WebSocketOpenEvent
  | WebSocketMessageEvent
  | WebSocketErrorEvent
  | WebSocketCloseEvent;

export type WebSocketEventLog = WebSocketEvent[];

const SocketIOConnections = new Map<string, Socket>();
const eventLogFileStreams = new Map<string, fs.WriteStream>();
const timelineFileStreams = new Map<string, fs.WriteStream>();

interface OpenSocketIORequestOptions {
  requestId: string;
  workspaceId: string;
  url: string;
  headers: RequestHeader[];
  cookieJar: CookieJar;
  initialPayload?: string;
}
const openSocketIOConnection = async (
  _event: Electron.IpcMainInvokeEvent,
  options: OpenSocketIORequestOptions
): Promise<void> => {
  const existingConnection = SocketIOConnections.get(options.requestId);

  if (existingConnection) {
    console.warn('Connection still open');
    return;
  }

  const request = await socketIORequest.getById(options.requestId);
  const responseId = generateId('res');
  if (!request) {
    return;
  }

  const responsesDir = path.join(process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData'), 'responses');

  const responseBodyPath = path.join(responsesDir, uuidV4() + '.response');
  eventLogFileStreams.set(options.requestId, fs.createWriteStream(responseBodyPath));
  const timelinePath = path.join(responsesDir, responseId + '.timeline');
  timelineFileStreams.set(options.requestId, fs.createWriteStream(timelinePath));

  try {
    if (!options.url) {
      throw new Error('URL is required');
    }
    const readyStateChannel = `socketIO.${request._id}.readyState`;

    const reduceArrayToLowerCaseKeyedDictionary = (acc: { [key: string]: string }, { name, value }: BaseWebSocketRequest['headers'][0]) =>
      ({ ...acc, [name.toLowerCase() || '']: value || '' });
    const headers = options.headers;
    const url = options.url;

    const lowerCasedEnabledHeaders = headers
      .filter(({ name, disabled }) => Boolean(name) && !disabled)
      .reduce(reduceArrayToLowerCaseKeyedDictionary, {});

    const socket = SocketIOClient(url, {
      extraHeaders: lowerCasedEnabledHeaders,
    });
    SocketIOConnections.set(options.requestId, socket);

    socket.on('connect', () => {
      console.log('socket io client connected');
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(readyStateChannel, socket.connected);
      }
    });

    socket.on('disconnect', (reason, details) => {
      console.log(reason, details);
      deleteRequestMaps(request._id,);
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(readyStateChannel, socket.connected);
      }
    });

    socket.on('connect_error', error => {
      console.log('connect_error', error.message);
      socket.close();
      deleteRequestMaps(request._id);
    });

    // TODO: listen to all opened events

  } catch (e) {
    console.error('unhandled error:', e);
    deleteRequestMaps(request._id);
  }
};

const deleteRequestMaps = async (requestId: string) => {
  SocketIOConnections.delete(requestId);
};

const getSocketIOReadyState = async (
  options: { requestId: string }
): Promise<boolean> => {
  return Boolean(SocketIOConnections.get(options.requestId)?.connected);
};

const sendPayload = async (socket: Socket, options: { requestId: string; eventName: string; args: any[]; ack?: boolean }): Promise<void> => {
  const { eventName, args, ack } = options;
  if (!eventName) {
    console.warn('No event name provided');
    return;
  }
  if (!ack) {
    socket.emit(eventName, ...args);
  } else {
    socket.emit(eventName, ...args, (...ack: any[]) => {
      // TODO: handle ack response
      console.log('ack response', ...ack);
    });
  }
};

const sendWebSocketEvent = async (
  options: { requestId: string; eventName: string; args: any[]; ack?: boolean }
): Promise<void> => {
  const socket = SocketIOConnections.get(options.requestId);

  if (!socket) {
    console.warn('No socket found for requestId: ' + options.requestId);
    return;
  }

  sendPayload(socket, options);
};

const closeSocketIOConnection = (
  options: { requestId: string }
): void => {
  const socket = SocketIOConnections.get(options.requestId);
  if (!socket) {
    return;
  }
  socket.close();
};

const closeAllSocketIOConnections = (): void => SocketIOConnections.forEach(socket => socket.close());

const addSocketIOListener = (options: { eventName: string; requestId: string }) => {
  console.log('start listen event:', options.eventName);
  const socket = SocketIOConnections.get(options.requestId);

  if (!socket) {
    console.warn('No socket found for requestId: ' + options.requestId);
    return;
  }

  socket.on(options.eventName, (...message: any[]) => {
    console.log('received message', message);
  });
};

const removeSocketIOListener = (options: { eventName: string; requestId: string }) => {
  console.log('off listen event:', options.eventName);
  const socket = SocketIOConnections.get(options.requestId);

  if (!socket) {
    console.warn('No socket found for requestId: ' + options.requestId);
    return;
  }

  socket.off(options.eventName);
};

export interface SocketIOBridgeAPI {
  open: (options: OpenSocketIORequestOptions) => void;
  close: typeof closeSocketIOConnection;
  closeAll: typeof closeAllSocketIOConnections;
  readyState: {
    getCurrent: typeof getSocketIOReadyState;
  };
  event: {
    // findMany: typeof findMany;
    send: typeof sendWebSocketEvent;
    on: typeof addSocketIOListener;
    off: typeof removeSocketIOListener;
  };
}
export const registerSocketIOHandlers = () => {
  ipcMainHandle('socketIO.open', openSocketIOConnection);
  ipcMainHandle('socketIO.event.send', (_, options: Parameters<typeof sendWebSocketEvent>[0]) => sendWebSocketEvent(options));
  ipcMainHandle('socketIO.readyState', (_, options: Parameters<typeof getSocketIOReadyState>[0]) => getSocketIOReadyState(options));
  ipcMainOn('socketIO.close', (_, options: Parameters<typeof closeSocketIOConnection>[0]) => closeSocketIOConnection(options));
  ipcMainOn('socketIO.closeAll', closeAllSocketIOConnections);
  ipcMainOn('socketIO.event.on', (_, options: Parameters<typeof addSocketIOListener>[0]) => addSocketIOListener(options));
  ipcMainOn('socketIO.event.off', (_, options: Parameters<typeof removeSocketIOListener>[0]) => removeSocketIOListener(options));
};

electron.app.on('window-all-closed', closeAllSocketIOConnections);
