import fs from 'node:fs';
import path from 'node:path';

import electron, { BrowserWindow } from 'electron';
import { v4 as uuidV4 } from 'uuid';

import { generateId } from '../../common/misc';
import * as models from '../../models';
import type { CookieJar } from '../../models/cookie-jar';
import type { RequestAuthentication, RequestHeader } from '../../models/request';
import { readCurlResponse } from '../../models/response';
import { ipcMainHandle, ipcMainOn } from '../ipc/electron';

// Mock curl connection interface for compatibility
export interface CurlConnection {
  _id: string;
  requestId: string;
  isOpen: boolean;
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

const CurlConnections = new Map<string, CurlConnection>();
const eventLogFileStreams = new Map<string, fs.WriteStream>();
const timelineFileStreams = new Map<string, fs.WriteStream>();

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
  options: OpenCurlRequestOptions,
): Promise<void> => {
  const existingConnection = CurlConnections.get(options.requestId);

  if (existingConnection) {
    console.warn('Connection still open to ' + options.url);
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

  try {
    if (!options.url) {
      throw new Error('URL is required');
    }
    const readyStateChannel = `curl.${request._id}.readyState`;
    
    // Create mock curl connection
    const mockCurl: CurlConnection = {
      _id: uuidV4(),
      requestId: options.requestId,
      isOpen: true,
    };

    CurlConnections.set(options.requestId, mockCurl);

    // For now, just create a mock response since this is streaming functionality
    // In a real implementation, you'd need to implement SSE/WebSocket support using native Node.js
    console.warn('Streaming connections not yet implemented with child_process curl. Using mock response.');

    const errorEvent: CurlErrorEvent = {
      _id: uuidV4(),
      requestId: options.requestId,
      message: 'Streaming connections not implemented',
      type: 'error',
      error: new Error('Streaming connections not implemented'),
      timestamp: Date.now(),
    };

    deleteRequestMaps(request._id, 'Streaming not implemented', errorEvent);
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(readyStateChannel, false);
    }

  } catch (error: any) {
    const errorEvent: CurlErrorEvent = {
      _id: uuidV4(),
      requestId: options.requestId,
      message: error.message,
      type: 'error',
      error,
      timestamp: Date.now(),
    };
    console.error('curl - error: ', error);
    deleteRequestMaps(options.requestId, error.message, errorEvent);
  }
};

const deleteRequestMaps = async (requestId: string, message: string, event?: CurlCloseEvent | CurlErrorEvent) => {
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
  const statusCode = 0; // Mock status code
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
  deleteRequestMaps(options.requestId, 'Closing connection', closeEvent);
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(readyStateChannel, false);
  }
};

const closeAllCurlConnections = (): void => CurlConnections.forEach(curl => curl.isOpen && (curl.isOpen = false));

const findMany = async (options: { responseId: string }): Promise<CurlEvent[]> => {
  const response = await models.response.getById(options.responseId);
  if (!response || !response.bodyPath) {
    return [];
  }

  const body = await fs.promises.readFile(response.bodyPath);
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
