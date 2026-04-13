import fs from 'node:fs';
import type { Readable } from 'node:stream';
import zlib from 'node:zlib';

import type { Compression, McpResponse, Response, SocketIOResponse, WebSocketResponse } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';
import type { ResponseTimelineEntry } from '~/main/network/libcurl-promise';
import { deserializeNDJSON } from '~/utils/ndjson';

import * as settingsService from '../settings';

const { isResponse, type: responseType } = models.response;

const safeUnlink = async (filePath?: string) => {
  if (!filePath) {
    return;
  }

  await fs.promises.unlink(filePath).catch(() => {});
};

export async function removeResponsesForRequest(requestId: string, environmentId?: string | null) {
  const settings = await settingsService.get();
  const query: Record<string, any> = {
    parentId: requestId,
  };

  if (environmentId !== undefined && settings.filterResponsesByEnv) {
    query.environmentId = environmentId;
  }

  const type = models.webSocketRequest.isWebSocketRequestId(requestId)
    ? models.webSocketResponse.type
    : models.socketIORequest.isSocketIORequestId(requestId)
      ? models.socketIOResponse.type
      : models.mcpRequest.isMcpRequestId(requestId)
        ? models.mcpResponse.type
        : responseType;

  if (
    type === models.webSocketResponse.type ||
    type === models.socketIOResponse.type ||
    type === models.mcpResponse.type
  ) {
    const toDelete = await db.find<WebSocketResponse | SocketIOResponse | McpResponse>(type, query);

    await Promise.all(toDelete.flatMap(doc => [safeUnlink(doc.eventLogPath), safeUnlink(doc.timelinePath)]));
  } else if (type === responseType) {
    const toDelete = await db.find<Response>(type, query);

    await Promise.all(toDelete.flatMap(doc => [safeUnlink(doc.bodyPath), safeUnlink(doc.timelinePath)]));
  }

  await db.removeWhere(type, query);
}

export async function removeResponse(response: Response | WebSocketResponse | SocketIOResponse | McpResponse) {
  if (
    models.webSocketResponse.isWebSocketResponse(response) ||
    models.socketIOResponse.isSocketIOResponse(response) ||
    models.mcpResponse.isMcpResponse(response)
  ) {
    await Promise.all([safeUnlink(response.eventLogPath), safeUnlink(response.timelinePath)]);
  } else if (isResponse(response)) {
    await Promise.all([safeUnlink(response.bodyPath), safeUnlink(response.timelinePath)]);
  }

  return db.remove(response);
}

export const getBodyStream = async (
  response?: { bodyPath?: string; bodyCompression?: Compression },
  readFailureValue?: string,
): Promise<Readable | string | null> => {
  if (!response?.bodyPath) {
    return null;
  }

  try {
    await fs.promises.stat(response.bodyPath);
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return readFailureValue === undefined ? null : readFailureValue;
  }

  if (response.bodyCompression === 'zip') {
    return fs.createReadStream(response.bodyPath).pipe(zlib.createGunzip());
  }

  return fs.createReadStream(response.bodyPath);
};

export const readCurlResponse = async (options: { bodyPath?: string; bodyCompression?: Compression }) => {
  const readFailureMsg = '[main/curlBridgeAPI] failed to read response body message';
  const bodyBufferOrErrMsg = await getBodyBuffer(options, readFailureMsg);

  if (!bodyBufferOrErrMsg) {
    return { body: '', error: readFailureMsg };
  }

  if (typeof bodyBufferOrErrMsg === 'string') {
    if (bodyBufferOrErrMsg === readFailureMsg) {
      return { body: '', error: readFailureMsg };
    }

    return { body: '', error: `unknown error in loading response body: ${bodyBufferOrErrMsg}` };
  }

  return { body: bodyBufferOrErrMsg.toString('utf8'), error: '' };
};

export async function getTimeline(response: Response, showBody?: boolean) {
  const { timelinePath, bodyPath } = response;

  if (!timelinePath) {
    return [];
  }

  try {
    const rawBuffer = await fs.promises.readFile(timelinePath);
    const timelineString = rawBuffer.toString();
    const timeline = deserializeNDJSON(timelineString);

    const body: ResponseTimelineEntry[] =
      showBody && bodyPath
        ? [
            {
              name: 'DataOut',
              timestamp: Date.now(),
              value: (await fs.promises.readFile(bodyPath)).toString(),
            },
          ]
        : [];

    return [...timeline, ...body];
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return [];
  }
}

export const getBodyBuffer = async (
  response?: { bodyPath?: string; bodyCompression?: Compression },
  readFailureValue?: string,
): Promise<Buffer | string> => {
  if (!response?.bodyPath) {
    return Buffer.alloc(0);
  }

  try {
    const rawBuffer = await fs.promises.readFile(response.bodyPath);

    if (response.bodyCompression === 'zip') {
      return new Promise((resolve, reject) =>
        zlib.gunzip(rawBuffer, (err, buffer) => (err ? reject(err) : resolve(buffer))),
      );
    }

    return rawBuffer;
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return readFailureValue === undefined ? Buffer.alloc(0) : readFailureValue;
  }
};
