import { ipcMain } from 'electron';
import { v4 as uuidV4 } from 'uuid';
import {
  CloseEvent,
  ErrorEvent,
  Event as OpenEvent,
  MessageEvent,
  WebSocket,
} from 'ws';

import { websocketRequest } from '../../models';

export interface WebSocketConnection extends WebSocket {
  _id: string;
  requestId: string;
}

export type WebsocketOpenEvent = Omit<OpenEvent, 'target'> & {
  _id: string;
  requestId: string;
  type: 'open';
};

export type WebsocketMessageEvent = Omit<MessageEvent, 'target'> & {
  _id: string;
  requestId: string;
  direction: 'OUTGOING' | 'INCOMING';
  type: 'message';
};

export type WebsocketErrorEvent = Omit<ErrorEvent, 'target'> & {
  _id: string;
  requestId: string;
  type: 'error';
};

export type WebsocketCloseEvent = Omit<CloseEvent, 'target'> & {
  _id: string;
  requestId: string;
  type: 'close';
};

export type WebsocketEvent =
  | WebsocketOpenEvent
  | WebsocketMessageEvent
  | WebsocketErrorEvent
  | WebsocketCloseEvent;

export type WebSocketEventLog = WebsocketEvent[];

// @TODO: Volatile state for now, later we might want to persist event logs.
const WebSocketConnections = new Map<string, WebSocket>();
const WebSocketEventLogs = new Map<string, WebSocketEventLog>();

async function createWebSocketConnection(
  event: Electron.IpcMainInvokeEvent,
  options: { requestId: string }
) {
  const existingConnection = WebSocketConnections.get(options.requestId);

  if (existingConnection) {
    console.warn('Connection still open to ' + existingConnection.url);
    return;
  }

  try {
    const request = await websocketRequest.getById(options.requestId);

    if (!request?.url) {
      throw new Error('No URL specified');
    }

    const eventChannel = `webSocketRequest.connection.${request._id}.event`;
    const readyStateChannel = `webSocketRequest.connection.${request._id}.readyState`;

    const ws = new WebSocket(request?.url);
    WebSocketConnections.set(options.requestId, ws);

    ws.addEventListener('open', () => {
      const openEvent: WebsocketOpenEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        type: 'open',
      };

      WebSocketEventLogs.set(options.requestId, [openEvent]);

      event.sender.send(eventChannel, openEvent);
      event.sender.send(readyStateChannel, ws.readyState);
    });

    ws.addEventListener('message', ({ data }) => {
      const msgs = WebSocketEventLogs.get(options.requestId) || [];
      const messageEvent: WebsocketMessageEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        data,
        type: 'message',
        direction: 'INCOMING',
      };

      WebSocketEventLogs.set(options.requestId, [...msgs, messageEvent]);
      event.sender.send(eventChannel, messageEvent);
    });

    ws.addEventListener('close', ({ code, reason, wasClean }) => {
      const msgs = WebSocketEventLogs.get(options.requestId) || [];
      const closeEvent: WebsocketCloseEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        code,
        reason,
        type: 'close',
        wasClean,
      };

      WebSocketEventLogs.set(options.requestId, [...msgs, closeEvent]);
      WebSocketConnections.delete(options.requestId);

      event.sender.send(eventChannel, closeEvent);
      event.sender.send(readyStateChannel, ws.readyState);
    });

    ws.addEventListener('error', ({ error, message }: ErrorEvent) => {
      const msgs = WebSocketEventLogs.get(options.requestId) || [];
      const errorEvent: WebsocketErrorEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        message,
        type: 'error',
        error,
      };

      WebSocketEventLogs.set(options.requestId, [...msgs, errorEvent]);
      WebSocketConnections.delete(options.requestId);

      event.sender.send(eventChannel, errorEvent);
      event.sender.send(readyStateChannel, ws.readyState);
    });
  } catch (e) {
    console.error(e);
    throw e;
  }
}

function getWebSocketReadyState(
  _event: Electron.IpcMainInvokeEvent,
  options: { requestId: string }
): WebSocketConnection['readyState'] {
  return WebSocketConnections.get(options.requestId)?.readyState ?? 0;
}

async function sendWebSocketEvent(
  event: Electron.IpcMainInvokeEvent,
  options: { message: string; requestId: string }
) {
  const ws = WebSocketConnections.get(options.requestId);

  if (!ws) {
    console.warn('No websocket found for requestId: ' + options.requestId);
    return;
  }

  ws.send(options.message, error => {
    // @TODO: We might want to set a status in the WebsocketMessageEvent
    // and update it here based on the error. e.g. status = 'sending' | 'sent' | 'error'
    if (error) {
      console.error(error);
    } else {
      console.log('Message sent');
    }
  });

  const connectionMessages = WebSocketEventLogs.get(options.requestId) || [];

  const lastMessage: WebsocketMessageEvent = {
    _id: uuidV4(),
    requestId: options.requestId,
    data: options.message,
    direction: 'OUTGOING',
    type: 'message',
  };

  WebSocketEventLogs.set(options.requestId, [
    ...connectionMessages,
    lastMessage,
  ]);
  const eventChannel = `webSocketRequest.connection.${options.requestId}.event`;
  event.sender.send(eventChannel, lastMessage);
}

async function closeWebSocketConnection(
  _event: Electron.IpcMainInvokeEvent,
  options: { requestId: string }
) {
  const ws = WebSocketConnections.get(options.requestId);
  if (!ws) {
    console.warn('No websocket found for requestId: ' + options.requestId);
    return;
  }
  ws.close();
}

async function getWebSocketConnectionEvents(
  _event: Electron.IpcMainInvokeEvent,
  options: { requestId: string }
) {
  const connectionMessages = WebSocketEventLogs.get(options.requestId) || [];
  return connectionMessages;
}

export function registerWebSocketHandlers() {
  ipcMain.handle('webSocketRequest.connection.create', createWebSocketConnection);
  ipcMain.handle('webSocketRequest.connection.readyState', getWebSocketReadyState);
  ipcMain.handle('webSocketRequest.connection.event.send', sendWebSocketEvent);
  ipcMain.handle('webSocketRequest.connection.close', closeWebSocketConnection);
  ipcMain.handle('webSocketRequest.connection.event.findMany', getWebSocketConnectionEvents);
}
