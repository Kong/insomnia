import fs from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';

import { Curl, CurlFeature, CurlInfoDebug, type HeaderInfo } from '@getinsomnia/node-libcurl';
import electron, { BrowserWindow } from 'electron';
import type { Response } from 'insomnia-data';
import { services } from 'insomnia-data';
import { v4 as uuidV4 } from 'uuid';

import { REALTIME_EVENTS_CHANNELS } from '~/common/constants';
import type { RenderedRequest } from '~/common/templating/types';
import { invariant } from '~/common/utils/invariant';
import { insecureReadFile } from '~/main/secure-read-file';

import { describeByteSize, generateId, getSetCookieHeaders } from '../../common/misc';
import { filterClientCertificates } from '../../network/certificate';
import { parseHeaderStrings } from '../../network/parse-header-strings';
import { addSetCookiesToToughCookieJar } from '../../network/set-cookie-util';
import { ipcMainHandle, ipcMainOn } from '../ipc/electron';
import { getAuthHeader } from './get-auth-header';
import { createConfiguredCurlInstance } from './libcurl-promise';

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

export type CurlEvent = CurlOpenEvent | CurlMessageEvent | CurlErrorEvent | CurlCloseEvent;

const protocolName = 'curl';
const CurlConnections = new Map<string, Curl>();
const requestIdToResponseIdMap = new Map<string, string>();
const eventLogFileStreams = new Map<string, fs.WriteStream>();
const timelineFileStreams = new Map<string, fs.WriteStream>();

const getEventNotificationChannel = (responseId: string) =>
  `${protocolName}.${responseId}.${REALTIME_EVENTS_CHANNELS.NEW_EVENT}`;
const writeEventLogAndNotify = ({
  requestId,
  data,
  clearRequestIdMap = false,
}: {
  requestId: string;
  data: any;
  clearRequestIdMap?: boolean;
}) => {
  eventLogFileStreams.get(requestId)?.write(data, () => {
    // notify all renderers of new event has been received
    for (const window of BrowserWindow.getAllWindows()) {
      const resId = requestIdToResponseIdMap.get(requestId);
      if (resId) {
        const notifyChannel = getEventNotificationChannel(resId);
        notifyChannel && window.webContents.send(notifyChannel);
        if (clearRequestIdMap) {
          // clean up maps after last event has been written to file
          requestIdToResponseIdMap.delete(requestId);
        }
      }
    }
  });
};

const parseHeadersAndBuildTimeline = (url: string, headersWithStatus: HeaderInfo) => {
  const { result, ...headers } = headersWithStatus;
  const statusMessage = result?.reason || '';
  const statusCode = result?.code || 0;
  const httpVersion = result?.version;
  const responseHeaders = Object.entries(headers).map(([name, value]) => ({ name, value: value?.toString() || '' }));
  const timeline = [{ value: `Preparing request to ${url}`, name: 'Text', timestamp: Date.now() }];
  return { timeline, responseHeaders, statusCode, statusMessage, httpVersion };
};
interface OpenCurlRequestOptions {
  workspaceId: string;
  renderedRequest: RenderedRequest;
  initialPayload?: string;
}
const openCurlConnection = async (
  _event: Electron.IpcMainInvokeEvent,
  options: OpenCurlRequestOptions,
): Promise<void> => {
  const { workspaceId, renderedRequest: req } = options;
  const requestId = req._id;
  const existingConnection = CurlConnections.get(requestId);

  if (existingConnection) {
    console.warn('Connection still open to ' + existingConnection.getInfo(Curl.info.EFFECTIVE_URL));
    return;
  }
  const responseId = generateId('res');

  const responsesDir = path.join(process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData'), 'responses');

  const responseBodyPath = path.join(responsesDir, uuidV4() + '.response');
  eventLogFileStreams.set(requestId, fs.createWriteStream(responseBodyPath));
  const timelinePath = path.join(responsesDir, responseId + '.timeline');
  timelineFileStreams.set(requestId, fs.createWriteStream(timelinePath));
  requestIdToResponseIdMap.set(requestId, responseId);

  const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspaceId);
  const environmentId: string = workspaceMeta.activeEnvironmentId || 'n/a';
  const environment = await services.environment.getById(environmentId || 'n/a');
  const responseEnvironmentId = environment ? environment._id : null;

  const caCert = await services.caCertificate.getByParentId(workspaceId);
  const caCertficatePath = caCert?.path || null;
  const caCertificate = caCertficatePath && (await insecureReadFile(caCertficatePath));

  try {
    invariant(req.url, 'URL must be defined');
    invariant(!req.url.startsWith('file://'), 'Local file URIs are not supported');

    const readyStateChannel = `${protocolName}.${requestId}.${REALTIME_EVENTS_CHANNELS.READY_STATE}`;

    const settings = await services.settings.get();
    const start = performance.now();
    const clientCertificates = await services.clientCertificate.findByParentId(workspaceId);
    const filteredClientCertificates = filterClientCertificates(clientCertificates, req.url, 'https:');

    const { header: authHeader, timeline: authTimeline } = await getAuthHeader(req, req.url);
    authTimeline?.forEach(entry => timelineFileStreams.get(requestId)?.write(JSON.stringify(entry) + '\n'));

    // request-level `cookies` aren't resolved for realtime connections (unlike the plain HTTP
    // send path), so cookie sending relies entirely on the cookie jar file below.
    const { curl, debugTimeline } = await createConfiguredCurlInstance({
      req: { ...req, cookies: [] },
      settings,
      caCert: caCertificate,
      certificates: filteredClientCertificates,
    });
    // set method
    curl.setOpt(Curl.option.CUSTOMREQUEST, req.method);
    // TODO: support all post data content types
    curl.setOpt(Curl.option.POSTFIELDS, req.body?.text || '');
    debugTimeline.forEach(entry => timelineFileStreams.get(requestId)?.write(JSON.stringify(entry) + '\n'));
    CurlConnections.set(requestId, curl);
    CurlConnections.get(requestId)?.enable(CurlFeature.StreamResponse);
    const headerStrings = parseHeaderStrings({ req, finalUrl: req.url, authHeader });

    CurlConnections.get(requestId)?.setOpt(Curl.option.HTTPHEADER, headerStrings);
    CurlConnections.get(requestId)?.on('error', async (error, errorCode) => {
      const errorEvent: CurlErrorEvent = {
        _id: uuidV4(),
        requestId,
        message: error.message,
        type: 'error',
        error,
        timestamp: Date.now(),
      };
      console.error('curl - error:', error, errorCode);
      CurlConnections.get(requestId)?.close();
      deleteRequestMaps(requestId, error.message, errorEvent);
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(readyStateChannel, false);
      }
      if (errorCode) {
        const res = await services.response.getById(responseId);
        if (!res) {
          createErrorResponse(
            responseId,
            requestId,
            responseEnvironmentId,
            timelinePath,
            error.message || 'Something went wrong creating curl response',
          );
        }
      }
    });

    CurlConnections.get(requestId)?.setOpt(Curl.option.DEBUGFUNCTION, (infoType, buffer) => {
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
      timelineFileStreams.get(requestId)?.write(JSON.stringify({ name, value, timestamp: Date.now() }) + '\n');
      return 0;
    });

    CurlConnections.get(requestId)?.on(
      'stream',
      async (stream: Readable, _code: number, [headersWithStatus]: HeaderInfo[]) => {
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send(readyStateChannel, true);
        }
        const { timeline, responseHeaders, statusCode, statusMessage, httpVersion } = parseHeadersAndBuildTimeline(
          req.url,
          headersWithStatus,
        );

        const responsePatch: Partial<Response> = {
          _id: responseId,
          parentId: requestId,
          environmentId: responseEnvironmentId,
          headers: responseHeaders,
          url: req.url,
          statusCode,
          statusMessage,
          httpVersion,
          elapsedTime: performance.now() - start,
          timelinePath,
          bodyPath: responseBodyPath,
          settingSendCookies: req.settingSendCookies,
          settingStoreCookies: req.settingStoreCookies,
          bodyCompression: null,
        };
        const settings = await services.settings.get();
        const res = await services.response.create(responsePatch, settings.maxHistoryResponses);
        services.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });

        if (req.settingStoreCookies) {
          const setCookieStrings: string[] = getSetCookieHeaders(responseHeaders).map(h => h.value);
          const totalSetCookies = setCookieStrings.length;
          if (totalSetCookies) {
            const currentUrl = req.url;
            const { cookies, rejectedCookies } = await addSetCookiesToToughCookieJar({
              setCookieStrings,
              currentUrl,
              cookieJar: req.cookieJar,
            });
            rejectedCookies.forEach(errorMessage =>
              timeline.push({ value: `Rejected cookie: ${errorMessage}`, name: 'Text', timestamp: Date.now() }),
            );
            const hasCookiesToPersist = totalSetCookies > rejectedCookies.length;
            if (hasCookiesToPersist) {
              await services.cookieJar.update(req.cookieJar, { cookies });
              timeline.push({ value: `Saved ${totalSetCookies} cookies`, name: 'Text', timestamp: Date.now() });
            }
          }
        }
        timeline.map(t => timelineFileStreams.get(requestId)?.write(JSON.stringify(t) + '\n'));

        invariant(eventLogFileStreams.get(requestId), 'writableStream should be defined');
        for await (const chunk of stream) {
          const messageEvent: CurlMessageEvent = {
            _id: uuidV4(),
            requestId,
            data: new TextDecoder('utf-8').decode(chunk),
            type: 'message',
            timestamp: Date.now(),
            direction: 'INCOMING',
          };
          writeEventLogAndNotify({ requestId, data: JSON.stringify(messageEvent) + '\n' });
        }

        // NOTE: when stream is closed by remote server
        const closeEvent: CurlCloseEvent = {
          _id: uuidV4(),
          requestId,
          type: 'close',
          timestamp: Date.now(),
          statusCode,
          reason: '',
          code: 0,
          wasClean: true,
        };
        CurlConnections.get(requestId)?.close();
        deleteRequestMaps(requestId, 'Closing connection', closeEvent);
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send(readyStateChannel, false);
        }
      },
    );
    curl.perform();
  } catch (e) {
    console.error('unhandled error:', e);

    deleteRequestMaps(requestId, e.message || 'Something went wrong opening curl connection');
    createErrorResponse(
      responseId,
      requestId,
      responseEnvironmentId,
      timelinePath,
      e.message || 'Something went wrong creating curl connection',
    );
  }
};

const createErrorResponse = async (
  responseId: string,
  requestId: string,
  environmentId: string | null,
  timelinePath: string,
  message: string,
) => {
  const settings = await services.settings.get();
  const responsePatch = {
    _id: responseId,
    parentId: requestId,
    environmentId: environmentId,
    timelinePath,
    statusMessage: 'Error',
    error: message,
  };
  const res = await services.response.create(responsePatch, settings.maxHistoryResponses);
  services.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });
};

const deleteRequestMaps = async (requestId: string, message: string, event?: CurlCloseEvent | CurlErrorEvent) => {
  if (event) {
    writeEventLogAndNotify({
      requestId: requestId,
      data: JSON.stringify(event) + '\n',
      clearRequestIdMap: true,
    });
  }
  eventLogFileStreams.get(requestId)?.end();
  eventLogFileStreams.delete(requestId);
  timelineFileStreams
    .get(requestId)
    ?.write(JSON.stringify({ value: message, name: 'Text', timestamp: Date.now() }) + '\n');
  timelineFileStreams.get(requestId)?.end();
  timelineFileStreams.delete(requestId);
  CurlConnections.delete(requestId);
};

const getCurlReadyState = async (options: { requestId: string }): Promise<CurlConnection['isOpen']> => {
  return CurlConnections.get(options.requestId)?.isOpen ?? false;
};

const closeCurlConnection = (_event: Electron.IpcMainInvokeEvent, options: { requestId: string }): void => {
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

const findMany = async (options: { responseId: string }): Promise<CurlEvent[]> => {
  const response = await services.response.getById(options.responseId);
  if (!response || !response.bodyPath) {
    return [];
  }
  const body = await insecureReadFile(response.bodyPath);
  return (
    body
      .split('\n')
      .filter(e => e?.trim())
      // Parse the message
      .map(e => JSON.parse(e))
      // Reverse the list of messages so that we get the latest message first
      .reverse() || []
  );
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
  ipcMainHandle('readCurlResponse', (_, options: Parameters<typeof services.helpers.readCurlResponse>[0]) =>
    services.helpers.readCurlResponse(options),
  );
};

electron.app.on('window-all-closed', closeAllCurlConnections);
