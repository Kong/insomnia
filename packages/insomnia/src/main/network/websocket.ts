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

const WebSocketConnections = new Map<string, WebSocket>();
const eventLogFileStreams = new Map<string, fs.WriteStream>();
const timelineFileStreams = new Map<string, fs.WriteStream>();

// Flow control state.

// CTS flag; When set, the renderer thread is accepting new WebSocket events.
let clearToSend = true;

// Send queue map; holds batches of events for each event channel, to be sent upon receiving a CTS signal.
const sendQueueMap = new Map<string, WebSocketEventLog>();

/**
 * Dispatches a websocket event to a renderer, using batching control flow logic.
 * When CTS is set, the events are sent immediately.
 * If CTS is cleared, the events are batched into the send queue.
 */
function dispatchWebSocketEvent(target: Electron.WebContents, eventChannel: string, wsEvent: WebSocketEvent): void {
  // If the CTS flag is already set, just send immediately.
  if (clearToSend) {
    target.send(eventChannel, [wsEvent]);
    clearToSend = false;
    return;
  }

  // Otherwise, append to send queue for this event channel.
  const sendQueue = sendQueueMap.get(eventChannel);
  if (sendQueue) {
    sendQueue.push(wsEvent);
  } else {
    sendQueueMap.set(eventChannel, [wsEvent]);
  }
}

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

  const responsesDir = path.join(process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData'), 'responses');
  mkdirp.sync(responsesDir);
  const responseBodyPath = path.join(responsesDir, uuidV4() + '.response');
  eventLogFileStreams.set(options.requestId, fs.createWriteStream(responseBodyPath));
  const timelinePath = path.join(responsesDir, uuidV4() + '.timeline');
  timelineFileStreams.set(options.requestId, fs.createWriteStream(timelinePath));

  try {
    const eventChannel = `webSocketRequest.connection.${responseId}.event`;
    const readyStateChannel = `webSocketRequest.connection.${request._id}.readyState`;

    // @TODO: Render nunjucks tags in these headers
    const reduceArrayToLowerCaseKeyedDictionary = (acc: { [key: string]: string }, { name, value }: BaseWebSocketRequest['headers'][0]) =>
      ({ ...acc, [name.toLowerCase() || '']: value || '' });
    const headers = request.headers.filter(({ value, disabled }) => !!value && !disabled)
      .reduce(reduceArrayToLowerCaseKeyedDictionary, {});

    const start = performance.now();
    const ws = new WebSocket(request.url, { headers });
    WebSocketConnections.set(options.requestId, ws);

    ws.on('upgrade', async incoming => {
      // @ts-expect-error -- private property
      const internalRequest = ws._req;
      // response
      const statusMessage = incoming.statusMessage || '';
      const statusCode = incoming.statusCode || 0;
      const httpVersion = incoming.httpVersion;
      const responseHeaders = Object.entries(incoming.headers).map(([name, value]) => ({ name, value: value?.toString() || '' }));
      const headersIn = responseHeaders.map(({ name, value }) => `${name}: ${value}`).join('\n');

      // @TODO: We may want to add set-cookie handling here.
      [
        { value: `Preparing request to ${request.url}`, name: 'Text', timestamp: Date.now() },
        { value: `Current time is ${new Date().toISOString()}`, name: 'Text', timestamp: Date.now() },
        { value: 'Using HTTP 1.1', name: 'Text', timestamp: Date.now() },
        { value: internalRequest._header, name: 'HeaderOut', timestamp: Date.now() },
        { value: `HTTP/${httpVersion} ${statusCode} ${statusMessage}`, name: 'HeaderIn', timestamp: Date.now() },
        { value: headersIn, name: 'HeaderIn', timestamp: Date.now() },
      ].map(t => timelineFileStreams.get(options.requestId)?.write(JSON.stringify(t) + '\n'));

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
      const openEvent: WebSocketOpenEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        type: 'open',
        timestamp: Date.now(),
      };

      eventLogFileStreams.get(options.requestId)?.write(JSON.stringify(openEvent) + '\n');
      timelineFileStreams.get(options.requestId)?.write(JSON.stringify({ value: 'WebSocket connection established', name: 'Text', timestamp: Date.now() }) + '\n');
      dispatchWebSocketEvent(event.sender, eventChannel, openEvent);
      event.sender.send(readyStateChannel, ws.readyState);
    });

    ws.addEventListener('message', ({ data }: MessageEvent) => {
      const messageEvent: WebSocketMessageEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        data,
        type: 'message',
        direction: 'INCOMING',
        timestamp: Date.now(),
      };

      eventLogFileStreams.get(options.requestId)?.write(JSON.stringify(messageEvent) + '\n');
      dispatchWebSocketEvent(event.sender, eventChannel, messageEvent);
    });

    ws.addEventListener('close', ({ code, reason, wasClean }) => {
      const closeEvent: WebSocketCloseEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        code,
        reason,
        type: 'close',
        wasClean,
        timestamp: Date.now(),
      };

      sendQueueMap.delete(eventChannel);
      const message = `Closing connection with code ${code}`;
      deleteRequestMaps(request._id, message, closeEvent);

      dispatchWebSocketEvent(event.sender, eventChannel, closeEvent);
      event.sender.send(readyStateChannel, ws.readyState);
    });

    ws.addEventListener('error', async ({ error, message }: ErrorEvent) => {
      console.error(error);

      const errorEvent: WebSocketErrorEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        message,
        type: 'error',
        error,
        timestamp: Date.now(),
      };

      deleteRequestMaps(request._id, message, errorEvent);

      dispatchWebSocketEvent(event.sender, eventChannel, errorEvent);
      event.sender.send(readyStateChannel, ws.readyState);

      createErrorResponse(responseId, request._id, timelinePath, message || 'Something went wrong');
    });
  } catch (e) {
    console.error('unhandled error:', e);

    deleteRequestMaps(request._id, e.message || 'Something went wrong');
    createErrorResponse(responseId, request._id, timelinePath, e.message || 'Something went wrong');
  }
}

async function createErrorResponse(responseId: string, requestId: string, timelinePath: string, message: string) {
  const settings = await models.settings.getOrCreate();
  const responsePatch = {
    _id: responseId,
    parentId: requestId,
    timelinePath,
    statusMessage: 'Error',
    error: message,
  };
  models.response.create(responsePatch, settings.maxHistoryResponses);
  models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: null });
}

async function deleteRequestMaps(requestId: string, message: string, event?: WebSocketCloseEvent | WebSocketErrorEvent,) {
  if (event) {
    eventLogFileStreams.get(requestId)?.write(JSON.stringify(event) + '\n');
  }
  eventLogFileStreams.get(requestId)?.end();
  eventLogFileStreams.delete(requestId);
  timelineFileStreams.get(requestId)?.write(JSON.stringify({ value: message, name: 'Text', timestamp: Date.now() }) + '\n');
  timelineFileStreams.get(requestId)?.end();
  timelineFileStreams.delete(requestId);
  WebSocketConnections.delete(requestId);
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
    // @TODO: We might want to set a status in the WebSocketMessageEvent
    // and update it here based on the error. e.g. status = 'sending' | 'sent' | 'error'
    if (error) {
      console.error(error);
    } else {
      console.log('Message sent');
    }
  });

  const lastMessage: WebSocketMessageEvent = {
    _id: uuidV4(),
    requestId: options.requestId,
    data: options.message,
    direction: 'OUTGOING',
    type: 'message',
    timestamp: Date.now(),
  };

  timelineFileStreams.get(options.requestId)?.write(JSON.stringify({ value: options.message, name: 'DataOut', timestamp: Date.now() }) + '\n');
  eventLogFileStreams.get(options.requestId)?.write(JSON.stringify(lastMessage) + '\n');
  const response = await models.response.getLatestByParentId(options.requestId);
  if (!response) {
    console.error('something went wrong');
    return;
  }
  const eventChannel = `webSocketRequest.connection.${response._id}.event`;
  dispatchWebSocketEvent(event.sender, eventChannel, lastMessage);
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

/**
 * Sets the CTS flag; sent when the UI is ready for more events.
 */
function signalClearToSend(event: Electron.IpcMainInvokeEvent) {
  const nextChannel = sendQueueMap.keys().next();

  // There are no pending events; just set the CTS flag.
  if (nextChannel.done) {
    clearToSend = true;
    return;
  }

  // We have batched events; immediately send one batch.
  const sendQueue = sendQueueMap.get(nextChannel.value);
  if (!sendQueue) {
    return;
  }

  event.sender.send(nextChannel.value, sendQueue);
  sendQueueMap.delete(nextChannel.value);
}

export function registerWebSocketHandlers() {
  ipcMain.handle('webSocketRequest.connection.create', createWebSocketConnection);
  ipcMain.handle('webSocketRequest.connection.readyState', getWebSocketReadyState);
  ipcMain.handle('webSocketRequest.connection.event.send', sendWebSocketEvent);
  ipcMain.handle('webSocketRequest.connection.close', closeWebSocketConnection);
  ipcMain.handle('webSocketRequest.connection.event.findMany', findMany);
  ipcMain.handle('webSocketRequest.connection.clearToSend', signalClearToSend);
}

electron.app.on('window-all-closed', () => {
  WebSocketConnections.forEach(ws => {
    ws.close();
  });
});
