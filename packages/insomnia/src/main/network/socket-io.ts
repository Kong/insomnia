import electron, { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { io as SocketIOClient, type Socket } from 'socket.io-client';
import { v4 as uuidV4 } from 'uuid';

import { generateId } from '../../common/misc';
import * as models from '../../models';
import { socketIORequest } from '../../models';
import type { CookieJar } from '../../models/cookie-jar';
import { type RequestHeader } from '../../models/request';
import type { BaseSocketIORequest } from '../../models/socket-io-request';
import type { SocketIOResponse } from '../../models/socket-io-response.ts';
import { ipcMainHandle, ipcMainOn } from '../ipc/electron';

export interface SocketIOpenEvent {
  _id: string;
  requestId: string;
  type: 'open';
  timestamp: number;
}

export interface SocketIOMessageEvent {
  _id: string;
  requestId: string;
  direction: 'OUTGOING' | 'INCOMING';
  type: 'message';
  timestamp: number;
  data: any[];
  eventName: string;
}

export interface SocketIOErrorEvent {
  _id: string;
  requestId: string;
  type: 'error';
  timestamp: number;
  message: string;
  error: any;
}

export interface SocketIOCloseEvent {
  _id: string;
  requestId: string;
  type: 'close';
  timestamp: number;
  reason: string;
}

export interface SocketIOListenEvent {
  _id: string;
  requestId: string;
  type: 'addEvent' | 'removeEvent';
  timestamp: number;
  eventName: string;
}

export interface SocketIOInfoEvent {
  _id: string;
  requestId: string;
  type: 'info';
  timestamp: number;
  message: string;
}

export type SocketIOEvent =
  | SocketIOpenEvent
  | SocketIOMessageEvent
  | SocketIOErrorEvent
  | SocketIOCloseEvent
  | SocketIOListenEvent
  | SocketIOInfoEvent;

export type SocketIOEventLog = SocketIOEvent[];

const SocketIOConnections = new Map<string, Socket>();
const eventLogFileStreams = new Map<string, fs.WriteStream>();
const timelineFileStreams = new Map<string, fs.WriteStream>();

const buildTimeline = (url: string) => {
  const timeline = [
    { value: `Connected to ${url}`, name: 'Text', timestamp: Date.now() },
    { value: `Current time is ${new Date().toISOString()}`, name: 'Text', timestamp: Date.now() },
  ];
  return timeline;
};

interface OpenSocketIORequestOptions {
  requestId: string;
  workspaceId: string;
  url: string;
  query: Record<string, string>;
  headers: RequestHeader[];
  cookieJar: CookieJar;
  initialPayload?: string;
}
const openSocketIOConnection = async (
  _event: Electron.IpcMainInvokeEvent,
  options: OpenSocketIORequestOptions,
): Promise<void> => {
  const start = performance.now();
  console.log('open socket io connection', options);
  const existingConnection = SocketIOConnections.get(options.requestId);

  if (existingConnection) {
    console.warn('Connection still open');
    return;
  }

  const request = await socketIORequest.getById(options.requestId);
  const responseId = generateId('res');
  console.log('responseId', responseId);
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

    const reduceArrayToLowerCaseKeyedDictionary = (
      acc: { [key: string]: string },
      { name, value }: BaseSocketIORequest['headers'][0],
    ) => ({ ...acc, [name.toLowerCase() || '']: value || '' });
    const headers = options.headers;
    const url = options.url;

    const lowerCasedEnabledHeaders = headers
      .filter(({ name, disabled }) => Boolean(name) && !disabled)
      .reduce(reduceArrayToLowerCaseKeyedDictionary, {});

    const socket = SocketIOClient(url, {
      extraHeaders: lowerCasedEnabledHeaders,
      query: options.query,
    });
    SocketIOConnections.set(options.requestId, socket);
    const openedEvents = request.eventListeners.filter(event => event.isOpen && event.eventName);

    socket.on('connect', async () => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(readyStateChannel, socket.connected);
      }

      const openEvent: SocketIOpenEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        type: 'open',
        timestamp: Date.now(),
      };

      eventLogFileStreams.get(options.requestId)?.write(JSON.stringify(openEvent) + '\n');

      if (!openedEvents.length) {
        const infoEvent: SocketIOInfoEvent = {
          _id: uuidV4(),
          requestId: options.requestId,
          type: 'info',
          message: 'Add event listeners to receive messages',
          timestamp: Date.now(),
        };
        eventLogFileStreams.get(options.requestId)?.write(JSON.stringify(infoEvent) + '\n');
      }

      const timeline = buildTimeline(url);
      timeline.map(t => timelineFileStreams.get(options.requestId)?.write(JSON.stringify(t) + '\n'));
      const responsePatch: Partial<SocketIOResponse> = {
        _id: responseId,
        parentId: request._id,
        environmentId: '',
        timelinePath,
        eventLogPath: responseBodyPath,
        elapsedTime: performance.now() - start,
        url: url,
        connected: true,
      };
      const settings = await models.settings.get();
      const res = await models.socketIOResponse.create(responsePatch, settings.maxHistoryResponses);
      models.requestMeta.updateOrCreateByParentId(request._id, { activeResponseId: res._id });
    });

    const engine = socket.io.engine;
    engine.once('upgrade', transport => {
      console.log('upgrade', transport);
      timelineFileStreams
        .get(request._id)
        ?.write(
          JSON.stringify({ value: `Upgraded to ${engine.transport.name}`, name: 'Text', timestamp: Date.now() }) + '\n',
        );
    });

    socket.on('disconnect', async (reason, details) => {
      console.log(reason, details);
      const closeEvent: SocketIOCloseEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        reason,
        type: 'close',
        timestamp: Date.now(),
      };
      deleteRequestMaps(request._id, reason, closeEvent);
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(readyStateChannel, socket.connected);
      }
      const response = await models.socketIOResponse.getById(responseId);
      if (response) {
        await models.socketIOResponse.update(response, { connected: false });
      }
    });

    socket.on('connect_error', error => {
      console.log('connect_error', error.message);
      socket.close();
      const errorEvent: SocketIOErrorEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        type: 'error',
        message: error.message,
        error,
        timestamp: Date.now(),
      };
      deleteRequestMaps(request._id, error.message, errorEvent);
    });

    // listen to all open events when the connection is opened
    openedEvents.forEach(event => {
      addSocketIOListener({ eventName: event.eventName, requestId: request._id });
    });
  } catch (e) {
    console.error('unhandled error:', e);
    const errorEvent: SocketIOErrorEvent = {
      _id: uuidV4(),
      requestId: options.requestId,
      type: 'error',
      message: e.message,
      error: e,
      timestamp: Date.now(),
    };
    deleteRequestMaps(request._id, e.message, errorEvent);
  }
};

const deleteRequestMaps = async (
  requestId: string,
  message: string,
  event?: SocketIOCloseEvent | SocketIOErrorEvent,
) => {
  if (event) {
    eventLogFileStreams.get(requestId)?.write(JSON.stringify(event) + '\n');
  }
  eventLogFileStreams.get(requestId)?.end();
  eventLogFileStreams.delete(requestId);
  timelineFileStreams
    .get(requestId)
    ?.write(JSON.stringify({ value: message, name: 'Text', timestamp: Date.now() }) + '\n');
  timelineFileStreams.get(requestId)?.end();
  timelineFileStreams.delete(requestId);
  SocketIOConnections.delete(requestId);
};

const getSocketIOReadyState = async (options: { requestId: string }): Promise<boolean> => {
  return Boolean(SocketIOConnections.get(options.requestId)?.connected);
};

const sendPayload = async (
  socket: Socket,
  options: { requestId: string; eventName: string; args: any[]; ack?: boolean },
): Promise<void> => {
  const { eventName = 'message', args, ack } = options;
  if (!ack) {
    socket.emit(eventName, ...args);
  } else {
    socket.emit(eventName, ...args, (...ack: any[]) => {
      console.log('ack response', ...ack);
      const ackEvent: SocketIOMessageEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        data: ack,
        direction: 'INCOMING',
        type: 'message',
        timestamp: Date.now(),
        eventName,
      };
      eventLogFileStreams.get(options.requestId)?.write(JSON.stringify(ackEvent) + '\n');
    });
  }

  const lastMessage: SocketIOMessageEvent = {
    _id: uuidV4(),
    requestId: options.requestId,
    data: args,
    direction: 'OUTGOING',
    type: 'message',
    timestamp: Date.now(),
    eventName,
  };

  eventLogFileStreams.get(options.requestId)?.write(JSON.stringify(lastMessage) + '\n');
};

const sendWebSocketEvent = async (options: {
  requestId: string;
  eventName: string;
  args: any[];
  ack?: boolean;
}): Promise<void> => {
  const socket = SocketIOConnections.get(options.requestId);

  if (!socket) {
    console.warn('No socket found for requestId: ' + options.requestId);
    return;
  }

  sendPayload(socket, options);
};

const closeSocketIOConnection = (options: { requestId: string }): void => {
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

  const onEvent: SocketIOListenEvent = {
    _id: uuidV4(),
    requestId: options.requestId,
    type: 'addEvent',
    timestamp: Date.now(),
    eventName: options.eventName,
  };
  eventLogFileStreams.get(options.requestId)?.write(JSON.stringify(onEvent) + '\n');

  socket.on(options.eventName, (...message: any[]) => {
    console.log('received message', message);
    const messageEvent: SocketIOMessageEvent = {
      _id: uuidV4(),
      requestId: options.requestId,
      data: message,
      type: 'message',
      direction: 'INCOMING',
      timestamp: Date.now(),
      eventName: options.eventName,
    };

    eventLogFileStreams.get(options.requestId)?.write(JSON.stringify(messageEvent) + '\n');
  });
};

const removeSocketIOListener = (options: { eventName: string; requestId: string }) => {
  console.log('off listen event:', options.eventName);
  const socket = SocketIOConnections.get(options.requestId);

  if (!socket) {
    console.warn('No socket found for requestId: ' + options.requestId);
    return;
  }
  const offEvent: SocketIOListenEvent = {
    _id: uuidV4(),
    requestId: options.requestId,
    type: 'removeEvent',
    timestamp: Date.now(),
    eventName: options.eventName,
  };
  eventLogFileStreams.get(options.requestId)?.write(JSON.stringify(offEvent) + '\n');

  socket.off(options.eventName);
};

const findMany = async (options: { responseId: string }): Promise<SocketIOEvent[]> => {
  const response = await models.socketIOResponse.getById(options.responseId);
  if (!response || !response.eventLogPath) {
    return [];
  }
  const body = await fs.promises.readFile(response.eventLogPath);
  return (
    body
      .toString()
      .split('\n')
      .filter(e => e?.trim())
      // Parse the message
      .map(e => JSON.parse(e))
      // Reverse the list of messages so that we get the latest message first
      .reverse() || []
  );
};

export interface SocketIOBridgeAPI {
  open: (options: OpenSocketIORequestOptions) => void;
  close: typeof closeSocketIOConnection;
  closeAll: typeof closeAllSocketIOConnections;
  readyState: {
    getCurrent: typeof getSocketIOReadyState;
  };
  event: {
    findMany: typeof findMany;
    send: typeof sendWebSocketEvent;
    on: typeof addSocketIOListener;
    off: typeof removeSocketIOListener;
  };
}
export const registerSocketIOHandlers = () => {
  ipcMainHandle('socketIO.open', openSocketIOConnection);
  ipcMainHandle('socketIO.event.send', (_, options: Parameters<typeof sendWebSocketEvent>[0]) =>
    sendWebSocketEvent(options),
  );
  ipcMainHandle('socketIO.readyState', (_, options: Parameters<typeof getSocketIOReadyState>[0]) =>
    getSocketIOReadyState(options),
  );
  ipcMainOn('socketIO.close', (_, options: Parameters<typeof closeSocketIOConnection>[0]) =>
    closeSocketIOConnection(options),
  );
  ipcMainOn('socketIO.closeAll', closeAllSocketIOConnections);
  ipcMainOn('socketIO.event.on', (_, options: Parameters<typeof addSocketIOListener>[0]) =>
    addSocketIOListener(options),
  );
  ipcMainOn('socketIO.event.off', (_, options: Parameters<typeof removeSocketIOListener>[0]) =>
    removeSocketIOListener(options),
  );
  ipcMainHandle('socketIO.event.findMany', (_, options: Parameters<typeof findMany>[0]) => findMany(options));
};

electron.app.on('window-all-closed', closeAllSocketIOConnections);
