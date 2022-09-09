import electron, { ipcMain } from 'electron';
import fs from 'fs';
import { IncomingMessage } from 'http';
import { setDefaultProtocol } from 'insomnia-url';
import mkdirp from 'mkdirp';
import path from 'path';
import { KeyObject, PxfObject } from 'tls';
import { v4 as uuidV4 } from 'uuid';
import {
  CloseEvent,
  ErrorEvent,
  Event,
  MessageEvent,
  WebSocket,
} from 'ws';

import { AUTH_BASIC, AUTH_BEARER } from '../../common/constants';
import { generateId } from '../../common/misc';
import { webSocketRequest } from '../../models';
import * as models from '../../models';
import { Environment } from '../../models/environment';
import { RequestAuthentication, RequestHeader } from '../../models/request';
import { BaseWebSocketRequest } from '../../models/websocket-request';
import type { WebSocketResponse } from '../../models/websocket-response';
import { getBasicAuthHeader } from '../../network/basic-auth/get-header';
import { getBearerAuthHeader } from '../../network/bearer-auth/get-header';
import { urlMatchesCertHost } from '../../network/url-matches-cert-host';

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

const parseResponseAndBuildTimeline = (url: string, incomingMessage: IncomingMessage, clientRequestHeaders: string) => {
  const statusMessage = incomingMessage.statusMessage || '';
  const statusCode = incomingMessage.statusCode || 0;
  const httpVersion = incomingMessage.httpVersion;
  const responseHeaders = Object.entries(incomingMessage.headers).map(([name, value]) => ({ name, value: value?.toString() || '' }));
  const headersIn = responseHeaders.map(({ name, value }) => `${name}: ${value}`).join('\n');
  const timeline = [
    { value: `Preparing request to ${url}`, name: 'Text', timestamp: Date.now() },
    { value: `Current time is ${new Date().toISOString()}`, name: 'Text', timestamp: Date.now() },
    { value: 'Using HTTP 1.1', name: 'Text', timestamp: Date.now() },
    { value: clientRequestHeaders, name: 'HeaderOut', timestamp: Date.now() },
    { value: `HTTP/${httpVersion} ${statusCode} ${statusMessage}`, name: 'HeaderIn', timestamp: Date.now() },
    { value: headersIn, name: 'HeaderIn', timestamp: Date.now() },
  ];
  return { timeline, responseHeaders, statusCode, statusMessage, httpVersion };
};

const createWebSocketConnection = async (
  event: Electron.IpcMainInvokeEvent,
  options: {
    requestId: string;
    workspaceId: string;
    url: string;
    headers: RequestHeader[];
    authentication: RequestAuthentication;
  }
): Promise<void> => {
  const existingConnection = WebSocketConnections.get(options.requestId);

  if (existingConnection) {
    console.warn('Connection still open to ' + existingConnection.url);
    return;
  }
  const request = await webSocketRequest.getById(options.requestId);
  const responseId = generateId('res');
  if (!request) {
    return;
  }

  const responsesDir = path.join(process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData'), 'responses');
  mkdirp.sync(responsesDir);
  const responseBodyPath = path.join(responsesDir, uuidV4() + '.response');
  eventLogFileStreams.set(options.requestId, fs.createWriteStream(responseBodyPath));
  const timelinePath = path.join(responsesDir, responseId + '.timeline');
  timelineFileStreams.set(options.requestId, fs.createWriteStream(timelinePath));

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(options.workspaceId);
  const environmentId: string = workspaceMeta.activeEnvironmentId || 'n/a';
  const environment: Environment | null = await models.environment.getById(environmentId || 'n/a');
  const responseEnvironmentId = environment ? environment._id : null;

  try {
    const readyStateChannel = `webSocket.${request._id}.readyState`;

    const reduceArrayToLowerCaseKeyedDictionary = (acc: { [key: string]: string }, { name, value }: BaseWebSocketRequest['headers'][0]) =>
      ({ ...acc, [name.toLowerCase() || '']: value || '' });
    const headers = options.headers;
    if (!options.authentication.disabled) {
      if (options.authentication.type === AUTH_BASIC) {
        const { username, password, useISO88591 } = options.authentication;
        const encoding = useISO88591 ? 'latin1' : 'utf8';
        headers.push(getBasicAuthHeader(username, password, encoding));
      }
      if (options.authentication.type === AUTH_BEARER) {
        const { token, prefix } = options.authentication;
        headers.push(getBearerAuthHeader(token, prefix));
      }
    }

    const lowerCasedEnabledHeaders = headers
      .filter(({ name, disabled }) => Boolean(name) && !disabled)
      .reduce(reduceArrayToLowerCaseKeyedDictionary, {});
    const settings = await models.settings.getOrCreate();
    const start = performance.now();

    const clientCertificates = await models.clientCertificate.findByParentId(options.workspaceId);
    const filteredClientCertificates = clientCertificates.filter(c => !c.disabled && urlMatchesCertHost(setDefaultProtocol(c.host, 'wss:'), options.url));
    const pemCertificates: string[] = [];
    const pemCertificateKeys: KeyObject[] = [];
    const pfxCertificates: PxfObject[] = [];

    filteredClientCertificates.forEach(clientCertificate => {
      const { passphrase, cert, key, pfx } = clientCertificate;

      if (cert) {
        timelineFileStreams.get(options.requestId)?.write(JSON.stringify({ value: `Adding SSL PEM certificate: ${cert}`, name: 'Text', timestamp: Date.now() }) + '\n');
        pemCertificates.push(fs.readFileSync(cert, 'utf-8'));
      }

      if (key) {
        timelineFileStreams.get(options.requestId)?.write(JSON.stringify({ value: `Adding SSL KEY certificate: ${key}`, name: 'Text', timestamp: Date.now() }) + '\n');
        pemCertificateKeys.push({ pem: fs.readFileSync(key, 'utf-8'), passphrase: passphrase ?? undefined });
      }

      if (pfx) {
        timelineFileStreams.get(options.requestId)?.write(JSON.stringify({ value: `Adding SSL P12 certificate: ${pfx}`, name: 'Text', timestamp: Date.now() }) + '\n');
        pfxCertificates.push({ buf: fs.readFileSync(pfx, 'utf-8'), passphrase: passphrase ?? undefined });
      }
    });

    const ws = new WebSocket(options.url, {
      headers: lowerCasedEnabledHeaders,
      cert: pemCertificates,
      key: pemCertificateKeys,
      pfx: pfxCertificates,
      rejectUnauthorized: settings.validateSSL,
      followRedirects: true,
    });
    WebSocketConnections.set(options.requestId, ws);

    ws.on('upgrade', async incomingMessage => {
      // @ts-expect-error -- private property
      const internalRequestHeader = ws._req._header;
      const { timeline, responseHeaders, statusCode, statusMessage, httpVersion } = parseResponseAndBuildTimeline(options.url, incomingMessage, internalRequestHeader);
      timeline.map(t => timelineFileStreams.get(options.requestId)?.write(JSON.stringify(t) + '\n'));
      const responsePatch: Partial<WebSocketResponse> = {
        _id: responseId,
        parentId: request._id,
        environmentId: responseEnvironmentId,
        headers: responseHeaders,
        url: options.url,
        statusCode,
        statusMessage,
        httpVersion,
        elapsedTime: performance.now() - start,
        timelinePath,
        eventLogPath: responseBodyPath,
      };
      const settings = await models.settings.getOrCreate();
      models.webSocketResponse.create(responsePatch, settings.maxHistoryResponses);
      models.requestMeta.updateOrCreateByParentId(request._id, { activeResponseId: null });
    });
    ws.on('unexpected-response', async (clientRequest, incomingMessage) => {
      incomingMessage.on('data', chunk => {
        timelineFileStreams.get(options.requestId)?.write(JSON.stringify({ value: chunk.toString(), name: 'DataOut', timestamp: Date.now() }) + '\n');
      });
      // @ts-expect-error -- private property
      const internalRequestHeader = clientRequest._header;
      const { timeline, responseHeaders, statusCode, statusMessage, httpVersion } = parseResponseAndBuildTimeline(options.url, incomingMessage, internalRequestHeader);
      timeline.map(t => timelineFileStreams.get(options.requestId)?.write(JSON.stringify(t) + '\n'));
      const responsePatch: Partial<WebSocketResponse> = {
        _id: responseId,
        parentId: request._id,
        environmentId: responseEnvironmentId,
        headers: responseHeaders,
        url: options.url,
        statusCode,
        statusMessage,
        httpVersion,
        elapsedTime: performance.now() - start,
        timelinePath,
        eventLogPath: responseBodyPath,
      };
      const settings = await models.settings.getOrCreate();
      models.webSocketResponse.create(responsePatch, settings.maxHistoryResponses);
      models.requestMeta.updateOrCreateByParentId(request._id, { activeResponseId: null });
      deleteRequestMaps(request._id, `Unexpected response ${incomingMessage.statusCode}`);
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

      const message = `Closing connection with code ${code}`;
      deleteRequestMaps(request._id, message, closeEvent);
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
      event.sender.send(readyStateChannel, ws.readyState);
      createErrorResponse(responseId, request._id, responseEnvironmentId, timelinePath, message || 'Something went wrong');
    });
  } catch (e) {
    console.error('unhandled error:', e);

    deleteRequestMaps(request._id, e.message || 'Something went wrong');
    createErrorResponse(responseId, request._id, responseEnvironmentId, timelinePath, e.message || 'Something went wrong');
  }
};

const createErrorResponse = async (responseId: string, requestId: string, environmentId: string | null, timelinePath: string, message: string) => {
  const settings = await models.settings.getOrCreate();
  const responsePatch = {
    _id: responseId,
    parentId: requestId,
    environmentId: environmentId,
    timelinePath,
    statusMessage: 'Error',
    error: message,
  };
  models.webSocketResponse.create(responsePatch, settings.maxHistoryResponses);
  models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: null });
};

const deleteRequestMaps = async (requestId: string, message: string, event?: WebSocketCloseEvent | WebSocketErrorEvent) => {
  if (event) {
    eventLogFileStreams.get(requestId)?.write(JSON.stringify(event) + '\n');
  }
  eventLogFileStreams.get(requestId)?.end();
  eventLogFileStreams.delete(requestId);
  timelineFileStreams.get(requestId)?.write(JSON.stringify({ value: message, name: 'Text', timestamp: Date.now() }) + '\n');
  timelineFileStreams.get(requestId)?.end();
  timelineFileStreams.delete(requestId);
  WebSocketConnections.delete(requestId);
};

const getWebSocketReadyState = async (
  options: { requestId: string }
): Promise<WebSocketConnection['readyState']> => {
  return WebSocketConnections.get(options.requestId)?.readyState ?? 0;
};

const sendWebSocketEvent = async (
  options: { message: string; requestId: string }
): Promise<void> => {
  const ws = WebSocketConnections.get(options.requestId);

  if (!ws) {
    console.warn('No websocket found for requestId: ' + options.requestId);
    return;
  }

  ws.send(options.message, error => {
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

  eventLogFileStreams.get(options.requestId)?.write(JSON.stringify(lastMessage) + '\n');
  const response = await models.webSocketResponse.getLatestByParentId(options.requestId);
  if (!response) {
    console.error('something went wrong');
    return;
  }
};

const closeWebSocketConnection = async (
  options: { requestId: string }
): Promise<void> => {
  const ws = WebSocketConnections.get(options.requestId);
  if (!ws) {
    return;
  }
  ws.close();
};

const closeAllWebSocketConnections = (): void => {
  WebSocketConnections.forEach(ws => ws.close());
};

const findMany = async (
  options: { responseId: string }
): Promise<WebSocketEvent[]> => {
  const response = await models.webSocketResponse.getById(options.responseId);
  if (!response || !response.eventLogPath) {
    return [];
  }
  const body = await fs.promises.readFile(response.eventLogPath);
  return body.toString().split('\n').filter(e => e?.trim())
    // Parse the message
    .map(e => JSON.parse(e))
    // Reverse the list of messages so that we get the latest message first
    .reverse() || [];
};

export interface WebSocketBridgeAPI {
  create: (options: {
    requestId: string;
    workspaceId: string;
    url: string;
    headers: RequestHeader[];
    authentication: RequestAuthentication;
  }) => void;
  close: typeof closeWebSocketConnection;
  closeAll: typeof closeAllWebSocketConnections;
  readyState: {
    getCurrent: typeof getWebSocketReadyState;
  };
  event: {
    findMany: typeof findMany;
    send: (options: { requestId: string; message: string }) => void;
  };
}
export const registerWebSocketHandlers = () => {
  ipcMain.handle('webSocket.create', createWebSocketConnection);
  ipcMain.handle('webSocket.event.send', (_, options: Parameters<typeof sendWebSocketEvent>[0]) => sendWebSocketEvent(options));
  ipcMain.handle('webSocket.close', (_, options: Parameters<typeof closeWebSocketConnection>[0]) => closeWebSocketConnection(options));
  ipcMain.handle('webSocket.closeAll', closeAllWebSocketConnections);
  ipcMain.handle('webSocket.readyState', (_, options: Parameters<typeof getWebSocketReadyState>[0]) => getWebSocketReadyState(options));
  ipcMain.handle('webSocket.event.findMany', (_, options: Parameters<typeof findMany>[0]) => findMany(options));
};

electron.app.on('window-all-closed', () => {
  WebSocketConnections.forEach(ws => {
    ws.close();
  });
});
