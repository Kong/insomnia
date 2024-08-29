import { Readable } from 'node:stream';

import { Curl, CurlFeature, CurlInfoDebug, type HeaderInfo } from '@getinsomnia/node-libcurl';
import electron, { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { v4 as uuidV4 } from 'uuid';

import { describeByteSize, generateId, getSetCookieHeaders } from '../../common/misc';
import * as models from '../../models';
import type { CookieJar } from '../../models/cookie-jar';
import type { Environment } from '../../models/environment';
import type { RequestAuthentication, RequestHeader } from '../../models/request';
import type { Response } from '../../models/response';
import { readCurlResponse } from '../../models/response';
import { filterClientCertificates } from '../../network/certificate';
import { addSetCookiesToToughCookieJar } from '../../network/set-cookie-util';
import { invariant } from '../../utils/invariant';
import { ipcMainHandle, ipcMainOn } from '../ipc/electron';
import { createConfiguredCurlInstance } from './libcurl-promise';
import { parseHeaderStrings } from './parse-header-strings';

export interface CurlConnection extends Curl {
  _id: string;
  requestId: string;
}

export interface CurlOpenEvent {
  _id: string;
  requestId: string;
  type: 'open';
  timestamp: number;
}

export interface CurlMessageEvent {
  _id: string;
  requestId: string;
  type: 'message';
  timestamp: number;
  data: string;
  direction: 'OUTGOING' | 'INCOMING';
}

export interface CurlErrorEvent {
  _id: string;
  requestId: string;
  type: 'error';
  timestamp: number;
  message: string;
  error: Error;
}

export interface CurlCloseEvent {
  _id: string;
  requestId: string;
  type: 'close';
  timestamp: number;
  statusCode: number;
  reason: string;
  wasClean: boolean;
  code: number;
}

export type CurlEvent =
  | CurlOpenEvent
  | CurlMessageEvent
  | CurlErrorEvent
  | CurlCloseEvent;

const CurlConnections = new Map<string, Curl>();
const eventLogFileStreams = new Map<string, fs.WriteStream>();
const timelineFileStreams = new Map<string, fs.WriteStream>();

const parseHeadersAndBuildTimeline = (url: string, headersWithStatus: HeaderInfo) => {
  const { result, ...headers } = headersWithStatus;
  const statusMessage = result?.reason || '';
  const statusCode = result?.code || 0;
  const httpVersion = result?.version;
  const responseHeaders = Object.entries(headers).map(([name, value]) => ({ name, value: value?.toString() || '' }));
  const timeline = [
    { value: `Preparing request to ${url}`, name: 'Text', timestamp: Date.now() },
  ];
  return { timeline, responseHeaders, statusCode, statusMessage, httpVersion };
};
interface OpenCurlRequestOptions {
  requestId: string;
  workspaceId: string;
  url: string;
  headers: RequestHeader[];
  authHeader?: { name: string; value: string };
  authentication: RequestAuthentication;
  cookieJar: CookieJar;
  initialPayload?: string;
  suppressUserAgent: boolean;
}
const openCurlConnection = async (
  _event: Electron.IpcMainInvokeEvent,
  options: OpenCurlRequestOptions
): Promise<void> => {
  const existingConnection = CurlConnections.get(options.requestId);

  if (existingConnection) {
    console.warn('Connection still open to ' + existingConnection.getInfo(Curl.info.EFFECTIVE_URL));
    return;
  }
  const request = await models.request.getById(options.requestId);
  const responseId = generateId('res');
  if (!request) {
    console.warn('Could not find request for ' + options.requestId);
    return;
  }

  const responsesDir = path.join(process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData'), 'responses');

  const responseBodyPath = path.join(responsesDir, uuidV4() + '.response');
  eventLogFileStreams.set(options.requestId, fs.createWriteStream(responseBodyPath));
  const timelinePath = path.join(responsesDir, responseId + '.timeline');
  timelineFileStreams.set(options.requestId, fs.createWriteStream(timelinePath));

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(options.workspaceId);
  const environmentId: string = workspaceMeta.activeEnvironmentId || 'n/a';
  const environment: Environment | null = await models.environment.getById(environmentId || 'n/a');
  const responseEnvironmentId = environment ? environment._id : null;

  const caCert = await models.caCertificate.findByParentId(options.workspaceId);
  const caCertficatePath = caCert?.path || null;
  const caCertificate = (caCertficatePath && (await fs.promises.readFile(caCertficatePath)).toString());

  try {
    if (!options.url) {
      throw new Error('URL is required');
    }
    const readyStateChannel = `curl.${request._id}.readyState`;

    const settings = await models.settings.get();
    const start = performance.now();
    const clientCertificates = await models.clientCertificate.findByParentId(options.workspaceId);
    const filteredClientCertificates = filterClientCertificates(clientCertificates, options.url, 'https:');
    const { curl, debugTimeline } = createConfiguredCurlInstance({
      req: { ...request, cookieJar: options.cookieJar, cookies: [], suppressUserAgent: options.suppressUserAgent },
      finalUrl: options.url,
      settings,
      caCert: caCertificate,
      certificates: filteredClientCertificates,
    });
    // set method
    curl.setOpt(Curl.option.CUSTOMREQUEST, request.method);
    // TODO: support all post data content types
    curl.setOpt(Curl.option.POSTFIELDS, request.body?.text || '');
    debugTimeline.forEach(entry => timelineFileStreams.get(options.requestId)?.write(JSON.stringify(entry) + '\n'));
    CurlConnections.set(options.requestId, curl);
    CurlConnections.get(options.requestId)?.enable(CurlFeature.StreamResponse);
    const headerStrings = parseHeaderStrings({ req: request, finalUrl: options.url, authHeader: options.authHeader });

    CurlConnections.get(options.requestId)?.setOpt(Curl.option.HTTPHEADER, headerStrings);
    CurlConnections.get(options.requestId)?.on('error', async (error, errorCode) => {
      const errorEvent: CurlErrorEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        message: error.message,
        type: 'error',
        error,
        timestamp: Date.now(),
      };
      console.error('curl - error: ', error, errorCode);
      CurlConnections.get(options.requestId)?.close();
      deleteRequestMaps(request._id, error.message, errorEvent);
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(readyStateChannel, false);
      }
      if (errorCode) {
        const res = await models.response.getById(responseId);
        if (!res) {
          createErrorResponse(responseId, request._id, responseEnvironmentId, timelinePath, error.message || 'Something went wrong');
        }
      }
    });

    CurlConnections.get(options.requestId)?.setOpt(Curl.option.DEBUGFUNCTION, (infoType, buffer) => {
      const isSSLData = infoType === CurlInfoDebug.SslDataIn || infoType === CurlInfoDebug.SslDataOut;
      const isEmpty = buffer.length === 0;
      // Don't show cookie setting because this will display every domain in the jar
      const isAddCookie = infoType === CurlInfoDebug.Text && buffer.toString('utf8').indexOf('Added cookie') === 0;
      if (isSSLData || isEmpty || isAddCookie) {
        return 0;
      }

      // NOTE: resolves "Text" from CurlInfoDebug[CurlInfoDebug.Text]
      let name = CurlInfoDebug[infoType] as keyof typeof CurlInfoDebug;
      let timelineMessage;
      const isRequestData = infoType === CurlInfoDebug.DataOut;
      if (isRequestData) {
        // Ignore large post data messages
        const isLessThan10KB = buffer.length / 1024 < (settings.maxTimelineDataSizeKB || 1);
        timelineMessage = isLessThan10KB ? buffer.toString('utf8') : `(${describeByteSize(buffer.length)} hidden)`;
      }
      const isResponseData = infoType === CurlInfoDebug.DataIn;
      if (isResponseData) {
        timelineMessage = `Received ${describeByteSize(buffer.length)} chunk`;
        name = 'Text';
      }
      const value = timelineMessage || buffer.toString('utf8');
      timelineFileStreams.get(options.requestId)?.write(JSON.stringify({ name, value, timestamp: Date.now() }) + '\n');
      return 0;
    });

    CurlConnections.get(options.requestId)?.on('stream', async (stream: Readable, _code: number, [headersWithStatus]: HeaderInfo[]) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(readyStateChannel, true);
      }
      const { timeline, responseHeaders, statusCode, statusMessage, httpVersion } = parseHeadersAndBuildTimeline(options.url, headersWithStatus);

      const responsePatch: Partial<Response> = {
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
        bodyPath: responseBodyPath,
        settingSendCookies: request.settingSendCookies,
        settingStoreCookies: request.settingStoreCookies,
        bodyCompression: null,
      };
      const settings = await models.settings.get();
      const res = await models.response.create(responsePatch, settings.maxHistoryResponses);
      models.requestMeta.updateOrCreateByParentId(request._id, { activeResponseId: res._id });

      if (request.settingStoreCookies) {
        const setCookieStrings: string[] = getSetCookieHeaders(responseHeaders).map(h => h.value);
        const totalSetCookies = setCookieStrings.length;
        if (totalSetCookies) {
          const currentUrl = request.url;
          const { cookies, rejectedCookies } = await addSetCookiesToToughCookieJar({ setCookieStrings, currentUrl, cookieJar: options.cookieJar });
          rejectedCookies.forEach(errorMessage => timeline.push({ value: `Rejected cookie: ${errorMessage}`, name: 'Text', timestamp: Date.now() }));
          const hasCookiesToPersist = totalSetCookies > rejectedCookies.length;
          if (hasCookiesToPersist) {
            await models.cookieJar.update(options.cookieJar, { cookies });
            timeline.push({ value: `Saved ${totalSetCookies} cookies`, name: 'Text', timestamp: Date.now() });
          }
        }
      }
      timeline.map(t => timelineFileStreams.get(options.requestId)?.write(JSON.stringify(t) + '\n'));

      invariant(eventLogFileStreams.get(request._id), 'writableStream should be defined');
      for await (const chunk of stream) {
        const messageEvent: CurlMessageEvent = {
          _id: uuidV4(),
          requestId: options.requestId,
          data: new TextDecoder('utf-8').decode(chunk),
          type: 'message',
          timestamp: Date.now(),
          direction: 'INCOMING',
        };
        eventLogFileStreams.get(options.requestId)?.write(JSON.stringify(messageEvent) + '\n');
      }

      // NOTE: when stream is closed by remote server
      const closeEvent: CurlCloseEvent = {
        _id: uuidV4(),
        requestId: options.requestId,
        type: 'close',
        timestamp: Date.now(),
        statusCode,
        reason: '',
        code: 0,
        wasClean: true,
      };
      CurlConnections.get(options.requestId)?.close();
      deleteRequestMaps(options.requestId, 'Closing connection', closeEvent);
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(readyStateChannel, false);
      }
    });
    curl.perform();
  } catch (e) {
    console.error('unhandled error:', e);

    deleteRequestMaps(request._id, e.message || 'Something went wrong');
    createErrorResponse(responseId, request._id, responseEnvironmentId, timelinePath, e.message || 'Something went wrong');
  }
};

const createErrorResponse = async (responseId: string, requestId: string, environmentId: string | null, timelinePath: string, message: string) => {
  const settings = await models.settings.get();
  const responsePatch = {
    _id: responseId,
    parentId: requestId,
    environmentId: environmentId,
    timelinePath,
    statusMessage: 'Error',
    error: message,
  };
  const res = await models.response.create(responsePatch, settings.maxHistoryResponses);
  models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });
};

const deleteRequestMaps = async (requestId: string, message: string, event?: CurlCloseEvent | CurlErrorEvent) => {
  if (event) {
    eventLogFileStreams.get(requestId)?.write(JSON.stringify(event) + '\n');
  }
  eventLogFileStreams.get(requestId)?.end();
  eventLogFileStreams.delete(requestId);
  timelineFileStreams.get(requestId)?.write(JSON.stringify({ value: message, name: 'Text', timestamp: Date.now() }) + '\n');
  timelineFileStreams.get(requestId)?.end();
  timelineFileStreams.delete(requestId);
  CurlConnections.delete(requestId);
};

const getCurlReadyState = async (
  options: { requestId: string }
): Promise<CurlConnection['isOpen']> => {
  return CurlConnections.get(options.requestId)?.isOpen ?? false;
};

const closeCurlConnection = (
  _event: Electron.IpcMainInvokeEvent,
  options: { requestId: string }
): void => {
  if (!CurlConnections.get(options.requestId)) {
    return;
  }
  const readyStateChannel = `curl.${options.requestId}.readyState`;
  const statusCode = +(CurlConnections.get(options.requestId)?.getInfo(Curl.info.HTTP_CONNECTCODE) || 0);
  const closeEvent: CurlCloseEvent = {
    _id: uuidV4(),
    requestId: options.requestId,
    type: 'close',
    timestamp: Date.now(),
    statusCode,
    reason: '',
    code: 0,
    wasClean: true,
  };
  CurlConnections.get(options.requestId)?.close();
  deleteRequestMaps(options.requestId, 'Closing connection', closeEvent);
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(readyStateChannel, false);
  }
};

const closeAllCurlConnections = (): void => CurlConnections.forEach(curl => curl.isOpen && curl.close());

const findMany = async (
  options: { responseId: string }
): Promise<CurlEvent[]> => {
  const response = await models.response.getById(options.responseId);
  if (!response || !response.bodyPath) {
    return [];
  }
  const body = await fs.promises.readFile(response.bodyPath);
  return body.toString().split('\n').filter(e => e?.trim())
    // Parse the message
    .map(e => JSON.parse(e))
    // Reverse the list of messages so that we get the latest message first
    .reverse() || [];
};

export interface CurlBridgeAPI {
  open: (options: OpenCurlRequestOptions) => void;
  close: (options: { requestId: string }) => void;
  closeAll: typeof closeAllCurlConnections;
  readyState: {
    getCurrent: typeof getCurlReadyState;
  };
  event: {
    findMany: typeof findMany;
  };
}

export const registerCurlHandlers = () => {
  ipcMainHandle('curl.open', openCurlConnection);
  ipcMainOn('curl.close', closeCurlConnection);
  ipcMainOn('curl.closeAll', closeAllCurlConnections);
  ipcMainHandle('curl.readyState', (_, options: Parameters<typeof getCurlReadyState>[0]) => getCurlReadyState(options));
  ipcMainHandle('curl.event.findMany', (_, options: Parameters<typeof findMany>[0]) => findMany(options));
  ipcMainHandle('readCurlResponse', (_, options: Parameters<typeof readCurlResponse>[0]) => readCurlResponse(options));
};

electron.app.on('window-all-closed', closeAllCurlConnections);
