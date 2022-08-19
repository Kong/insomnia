import electron, { ipcMain } from 'electron';
import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
import { v4 as uuidV4 } from 'uuid';
import {
  CloseEvent,
  ErrorEvent,
  Event,
  MessageEvent,
  WebSocket,
} from 'ws';

import { generateId } from '../../common/misc';
import { websocketRequest } from '../../models';
import * as models from '../../models';
import type { Response } from '../../models/response';
import { BaseWebSocketRequest } from '../../models/websocket-request';
import { storeTimeline } from '../../network/network';
import { ResponseTimelineEntry } from './libcurl-promise';

export interface WebSocketConnection extends WebSocket {
  _id: string;
  requestId: string;
}

export type WebsocketOpenEvent = Omit<Event, 'target'> & {
  _id: string;
  requestId: string;
  type: 'open';
  timestamp: number;
};

export type WebsocketMessageEvent = Omit<MessageEvent, 'target'> & {
  _id: string;
  requestId: string;
  direction: 'OUTGOING' | 'INCOMING';
  type: 'message';
  timestamp: number;
};

export type WebsocketErrorEvent = Omit<ErrorEvent, 'target'> & {
  _id: string;
  requestId: string;
  type: 'error';
  timestamp: number;
};

export type WebsocketCloseEvent = Omit<CloseEvent, 'target'> & {
  _id: string;
  requestId: string;
  type: 'close';
  timestamp: number;
};

export type WebsocketEvent =
  | WebsocketOpenEvent
  | WebsocketMessageEvent
  | WebsocketErrorEvent
  | WebsocketCloseEvent;

export type WebSocketEventLog = WebsocketEvent[];

const WebSocketConnections = new Map<string, WebSocket>();
const fileStreams = new Map<string, fs.WriteStream>();

async function createWebSocketConnection(
  event: Electron.IpcMainInvokeEvent,
  options: { requestId: string }
) {
  const existingConnection = WebSocketConnections.get(options.requestId);

  if (existingConnection) {
    console.warn('Connection still open to ' + existingConnection.url);
    return;
  }
  const request = await websocketRequest.getById(options.requestId);
  const responseId = generateId('res');
  if (!request) {
    return;
  }
  try {
    const eventChannel = `webSocketRequest.connection.${responseId}.event`;
    const readyStateChannel = `webSocketRequest.connection.${request._id}.readyState`;

    // @TODO: Render nunjucks tags in these headers
    const reduceArrayToLowerCaseKeyedDictionary = (acc: { [key: string]: string }, { name, value }: BaseWebSocketRequest['headers'][0]) =>
      ({ ...acc, [name.toLowerCase() || '']: value || '' });
    const headers = request.headers.filter(({ value, disabled }) => !!value && !disabled)
      .reduce(reduceArrayToLowerCaseKeyedDictionary, {});

    const ws = new WebSocket(request.url, { headers });
    WebSocketConnections.set(options.requestId, ws);
    const start = performance.now();
    const responsesDir = path.join(process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData'), 'responses');
    mkdirp.sync(responsesDir);
    const responseBodyPath = path.join(responsesDir, uuidV4() + '.response');
    fileStreams.set(options.requestId, fs.createWriteStream(responseBodyPath));
    ws.on('upgrade', async incoming => {
      // @TODO: We may want to add set-cookie handling here.
      const timeline: ResponseTimelineEntry[] = [];
      // request
      timeline.push({ value: `Preparing request to ${request.url}`, name: 'Text', timestamp: Date.now() });
      timeline.push({ value: `Current time is ${new Date().toISOString()}`, name: 'Text', timestamp: Date.now() });
      // @ts-expect-error -- private property
      const internalRequest = ws._req;
      timeline.push({ value: 'Using HTTP 1.1', name: 'Text', timestamp: Date.now() });
      timeline.push({ value: internalRequest._header, name: 'HeaderOut', timestamp: Date.now() });

      // response
      const statusMessage = incoming.statusMessage || '';
      const statusCode = incoming.statusCode || 0;
      const httpVersion = incoming.httpVersion;
      timeline.push({ value: `HTTP/${httpVersion} ${statusCode} ${statusMessage}`, name: 'HeaderIn', timestamp: Date.now() });
      const responseHeaders = Object.entries(incoming.headers).map(([name, value]) => ({ name, value: value?.toString() || '' }));
      const headersIn = responseHeaders.map(({ name, value }) => `${name}: ${value}`).join('\n');
      timeline.push({ value: headersIn, name: 'HeaderIn', timestamp: Date.now() });
      const timelinePath = await storeTimeline(timeline);
      const responsePatch: Partial<Response> = {
        _id: responseId,
        parentId: request._id,
        type: 'upgrade',
        headers: responseHeaders,
        url: request.url,
        statusCode,
        statusMessage,
        httpVersion,
        elapsedTime: performance.now() - start,
        timelinePath,
        bodyPath: responseBodyPath,
        bodyCompression: null,
      };
      const settings = await models.settings.getOrCreate();
      models.response.create(responsePatch, settings.maxHistoryResponses);
      models.requestMeta.updateOrCreateByParentId(request._id, { activeResponseId: null });
    });

    ws.addEventListener('open', () => {
      const openEvent: WebsocketOpenEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        type: 'open',
        timestamp: Date.now(),
      };

      fileStreams.get(options.requestId)?.write(JSON.stringify(openEvent) + '\n');
      event.sender.send(eventChannel, openEvent);
      event.sender.send(readyStateChannel, ws.readyState);
    });

    ws.addEventListener('message', ({ data }: MessageEvent) => {
      const messageEvent: WebsocketMessageEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        data,
        type: 'message',
        direction: 'INCOMING',
        timestamp: Date.now(),
      };

      fileStreams.get(options.requestId)?.write(JSON.stringify(messageEvent) + '\n');
      event.sender.send(eventChannel, messageEvent);
    });

    ws.addEventListener('close', ({ code, reason, wasClean }) => {
      const closeEvent: WebsocketCloseEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        code,
        reason,
        type: 'close',
        wasClean,
        timestamp: Date.now(),
      };

      fileStreams.get(options.requestId)?.write(JSON.stringify(closeEvent) + '\n');
      fileStreams.get(options.requestId)?.end();
      WebSocketConnections.delete(options.requestId);

      event.sender.send(eventChannel, closeEvent);
      event.sender.send(readyStateChannel, ws.readyState);
    });

    ws.addEventListener('error', ({ error, message }: ErrorEvent) => {
      console.error(error);

      const errorEvent: WebsocketErrorEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        message,
        type: 'error',
        error,
        timestamp: Date.now(),
      };

      fileStreams.get(options.requestId)?.write(JSON.stringify(errorEvent) + '\n');
      fileStreams.get(options.requestId)?.end();
      WebSocketConnections.delete(options.requestId);

      event.sender.send(eventChannel, errorEvent);
      event.sender.send(readyStateChannel, ws.readyState);
    });
  } catch (e) {
    console.error('message', e);
    const responsePatch = {
      _id: generateId('res'),
      parentId: request._id,
      statusMessage: 'Error',
      error: e.message || 'Something went wrong',
      elapsedTime: 0,
      httpVersion:'',
      statusCode: 0,
      headers: [],
    };
    const settings = await models.settings.getOrCreate();
    models.response.create(responsePatch, settings.maxHistoryResponses);
    models.requestMeta.updateOrCreateByParentId(request._id, { activeResponseId: null });
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
    // @TODO: Render nunjucks tags in these messages
    // @TODO: We might want to set a status in the WebsocketMessageEvent
    // and update it here based on the error. e.g. status = 'sending' | 'sent' | 'error'
    if (error) {
      console.error(error);
    } else {
      console.log('Message sent');
    }
  });

  const lastMessage: WebsocketMessageEvent = {
    _id: uuidV4(),
    requestId: options.requestId,
    data: options.message,
    direction: 'OUTGOING',
    type: 'message',
    timestamp: Date.now(),
  };

  fileStreams.get(options.requestId)?.write(JSON.stringify(lastMessage) + '\n');
  const response = await models.response.getLatestByParentId(options.requestId);
  if (!response) {
    console.error('something went wrong');
    return;
  }
  const eventChannel = `webSocketRequest.connection.${response._id}.event`;
  event.sender.send(eventChannel, lastMessage);
}

async function closeWebSocketConnection(
  _event: Electron.IpcMainInvokeEvent,
  options: { requestId: string }
) {
  const ws = WebSocketConnections.get(options.requestId);
  if (!ws) {
    return;
  }
  ws.close();
}

async function findMany(
  _event: Electron.IpcMainInvokeEvent,
  options: { responseId: string }
) {
  const response = await models.response.getById(options.responseId);
  if (!response || !response.bodyPath) {
    return [];
  }
  const body = await fs.promises.readFile(response.bodyPath);
  return body.toString().split('\n').filter(e => e?.trim())
    .map(e => JSON.parse(e)) || [];
}

export function registerWebSocketHandlers() {
  ipcMain.handle('webSocketRequest.connection.create', createWebSocketConnection);
  ipcMain.handle('webSocketRequest.connection.readyState', getWebSocketReadyState);
  ipcMain.handle('webSocketRequest.connection.event.send', sendWebSocketEvent);
  ipcMain.handle('webSocketRequest.connection.close', closeWebSocketConnection);
  ipcMain.handle('webSocketRequest.connection.event.findMany', findMany);
}

electron.app.on('window-all-closed', () => {
  WebSocketConnections.forEach(ws => {
    ws.close();
  });
});
