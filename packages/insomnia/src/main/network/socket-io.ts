import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';

import electron, { BrowserWindow } from 'electron';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { io as SocketIOClient, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';
import { v4 as uuidV4 } from 'uuid';

import { jarFromCookies } from '../../common/cookies';
import { generateId } from '../../common/misc';
import * as models from '../../models';
import { socketIORequest } from '../../models';
import type { CookieJar } from '../../models/cookie-jar';
import { type RequestHeader } from '../../models/request';
import type { BaseSocketIORequest } from '../../models/socket-io-request';
import type { SocketIOResponse } from '../../models/socket-io-response.ts';
import { filterClientCertificates } from '../../network/certificate';
import { invariant } from '../../utils/invariant';
import { setDefaultProtocol } from '../../utils/url/protocol';
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

const getCertificates = async ({
  workspaceId,
  url,
  requestId,
}: {
  workspaceId: string;
  url: string;
  requestId: string;
}) => {
  // attach certificates to the request
  const caCert = await models.caCertificate.findByParentId(workspaceId);
  const caCertficatePath = !caCert?.disabled ? caCert?.path : '';
  // attempt to read CA Certificate PEM from disk, fallback to root certificates
  const caCertificate =
    (caCertficatePath && (await fs.promises.readFile(caCertficatePath)).toString()) || tls.rootCertificates.join('\n');

  const clientCertificates = await models.clientCertificate.findByParentId(workspaceId);
  const filteredClientCertificates = filterClientCertificates(clientCertificates, url, 'wss:');
  const pemCertificates: string[] = [];
  const pemCertificateKeys: string[] = [];
  const pfxCertificates: string[] = [];

  filteredClientCertificates.forEach(clientCertificate => {
    const { cert, key, pfx } = clientCertificate;

    if (cert) {
      timelineFileStreams
        .get(requestId)
        ?.write(
          JSON.stringify({ value: `Adding SSL PEM certificate: ${cert}`, name: 'Text', timestamp: Date.now() }) + '\n',
        );
      pemCertificates.push(fs.readFileSync(cert, 'utf-8'));
    }

    if (key) {
      timelineFileStreams
        .get(requestId)
        ?.write(
          JSON.stringify({ value: `Adding SSL KEY certificate: ${key}`, name: 'Text', timestamp: Date.now() }) + '\n',
        );
      pemCertificateKeys.push(fs.readFileSync(key, 'utf-8'));
    }

    if (pfx) {
      timelineFileStreams
        .get(requestId)
        ?.write(
          JSON.stringify({ value: `Adding SSL P12 certificate: ${pfx}`, name: 'Text', timestamp: Date.now() }) + '\n',
        );
      pfxCertificates.push(fs.readFileSync(pfx, 'utf-8'));
    }
  });

  return {
    caCertificate,
    pemCertificates,
    pemCertificateKeys,
    pfxCertificates,
    passphrase: filteredClientCertificates[0]?.passphrase || '',
  };
};

const getProxyAgent = (url: string, httpProxy: string, httpsProxy: string) => {
  const useHttpsProxy = url.startsWith('wss:') || url.startsWith('https:');
  return useHttpsProxy
    ? new HttpsProxyAgent(setDefaultProtocol(httpsProxy))
    : new HttpProxyAgent(setDefaultProtocol(httpProxy));
};

const createErrorResponse = async (
  responseId: string,
  requestId: string,
  environmentId: string | null,
  timelinePath: string,
  message: string,
) => {
  const settings = await models.settings.get();
  const responsePatch = {
    _id: responseId,
    parentId: requestId,
    environmentId: environmentId,
    timelinePath,
    statusMessage: 'Error',
    error: message,
  };
  const res = await models.socketIOResponse.create(responsePatch, settings.maxHistoryResponses);
  models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });
};

const openSocketIOConnection = async (
  _event: Electron.IpcMainInvokeEvent,
  options: OpenSocketIORequestOptions,
): Promise<void> => {
  const start = performance.now();
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

  // fallback to base environment
  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(options.workspaceId);
  const activeEnvironmentId = workspaceMeta.activeEnvironmentId;
  const activeEnvironment = activeEnvironmentId && (await models.environment.getById(activeEnvironmentId));
  const environment = activeEnvironment || (await models.environment.getOrCreateForParentId(options.workspaceId));
  invariant(environment, 'failed to find environment ' + activeEnvironmentId);
  const responseEnvironmentId = environment ? environment._id : null;

  try {
    if (!options.url) {
      throw new Error('URL is required');
    }
    const readyStateChannel = `socketIO.${request._id}.readyState`;

    const reduceArrayToLowerCaseKeyedDictionary = (
      acc: Record<string, string>,
      { name, value }: BaseSocketIORequest['headers'][0],
    ) => ({ ...acc, [name.toLowerCase() || '']: value || '' });
    const headers = options.headers;
    const url = options.url;

    const lowerCasedEnabledHeaders = headers
      .filter(({ name, disabled }) => Boolean(name) && !disabled)
      .reduce(reduceArrayToLowerCaseKeyedDictionary, {});

    // attach cookies to the request
    if (request.settingSendCookies && options.cookieJar.cookies.length) {
      const jar = jarFromCookies(options.cookieJar.cookies);
      const cookieHeader = jar.getCookieStringSync(options.url);
      lowerCasedEnabledHeaders['cookie'] = cookieHeader;
    }

    const { caCertificate, pemCertificates, pemCertificateKeys, pfxCertificates, passphrase } = await getCertificates({
      workspaceId: options.workspaceId,
      url: options.url,
      requestId: options.requestId,
    });
    const settings = await models.settings.get();

    const socketIOoptions: Partial<ManagerOptions & SocketOptions> = {
      extraHeaders: lowerCasedEnabledHeaders,
      query: options.query,
      ca: caCertificate,
      passphrase,
      // @ts-expect-error: Type mismatch for agent field
      agent: settings.proxyEnabled ? getProxyAgent(url, settings.httpProxy, settings.httpsProxy) : false,
    };

    if (pfxCertificates.length) {
      socketIOoptions.pfx = pfxCertificates.join('\n');
    } else {
      socketIOoptions.cert = pemCertificates.join('\n');
      socketIOoptions.key = pemCertificateKeys.join('\n');
    }

    const socket = SocketIOClient(url, socketIOoptions);
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
        environmentId: responseEnvironmentId,
        timelinePath,
        eventLogPath: responseBodyPath,
        elapsedTime: performance.now() - start,
        url: url,
      };

      const res = await models.socketIOResponse.create(responsePatch, settings.maxHistoryResponses);
      models.requestMeta.updateOrCreateByParentId(request._id, { activeResponseId: res._id });
    });

    const engine = socket.io.engine;
    engine.once('upgrade', () => {
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
      createErrorResponse(
        responseId,
        request._id,
        responseEnvironmentId,
        timelinePath,
        error.message || 'Something went wrong',
      );
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
    createErrorResponse(
      responseId,
      request._id,
      responseEnvironmentId,
      timelinePath,
      e.message || 'Something went wrong',
    );
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
