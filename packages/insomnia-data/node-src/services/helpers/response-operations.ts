import fs from 'node:fs';
import zlib from 'node:zlib';

import type {
  Compression,
  McpResponse,
  Response,
  ResponseTimelineEntry,
  SocketIOResponse,
  WebSocketResponse,
} from 'insomnia-data';
import { database as db, models } from 'insomnia-data';
import { deserializeNDJSON } from 'insomnia-data/common';

import * as settingsService from '../settings';

const { isResponse, type: responseType } = models.response;

export async function removeResponsesForRequest(requestId: string, environmentId?: string | null) {
  const settings = await settingsService.get();
  const query: Record<string, any> = {
    parentId: requestId,
  };

  // Only add if not undefined. null is not the same as undefined
  //  null: find responses sent from base environment
  //  undefined: find all responses
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
    for (const doc of toDelete) {
      fs.promises.unlink(doc.eventLogPath);
      fs.promises.unlink(doc.timelinePath);
    }
  } else if (type === responseType) {
    const toDelete = await db.find<Response>(type, query);
    for (const doc of toDelete) {
      fs.promises.unlink(doc.bodyPath);
      fs.promises.unlink(doc.timelinePath);
    }
  }

  // Also delete legacy responses here or else the user will be confused as to
  // why some responses are still showing in the UI.
  await db.removeWhere(type, query);
}

export function removeResponse(response: Response | WebSocketResponse | SocketIOResponse | McpResponse) {
  if (
    models.webSocketResponse.isWebSocketResponse(response) ||
    models.socketIOResponse.isSocketIOResponse(response) ||
    models.mcpResponse.isMcpResponse(response)
  ) {
    fs.promises.unlink(response.eventLogPath);
    fs.promises.unlink(response.timelinePath);
  } else if (isResponse(response)) {
    fs.promises.unlink(response.bodyPath);
    fs.promises.unlink(response.timelinePath);
  }
  return db.remove(response);
}

export const readCurlResponse = async (options: { bodyPath?: string; bodyCompression?: Compression }) => {
  const readFailureMsg = '[main/curlBridgeAPI] failed to read response body message';
  const bodyBufferOrErrMsg = await getResponseBodyBuffer(options, readFailureMsg);
  // TODO(jackkav): simplify the fail msg and reuse in other getBodyBuffer renderer calls

  if (!bodyBufferOrErrMsg) {
    return { body: '', error: readFailureMsg };
  } else if (typeof bodyBufferOrErrMsg === 'string') {
    if (bodyBufferOrErrMsg === readFailureMsg) {
      return { body: '', error: readFailureMsg };
    }
    return { body: '', error: `unknown error in loading response body: ${bodyBufferOrErrMsg}` };
  }

  return { body: bodyBufferOrErrMsg.toString('utf8'), error: '' };
};

export async function getResponseTimeline(response: Response, showBody?: boolean): Promise<ResponseTimelineEntry[]> {
  const { timelinePath, bodyPath } = response;

  if (!timelinePath) {
    return [];
  }

  try {
    const rawBuffer = await fs.promises.readFile(timelinePath);
    const timelineString = rawBuffer.toString();
    const timeline = deserializeNDJSON(timelineString);

    const body: ResponseTimelineEntry[] = showBody
      ? [
          {
            name: 'DataOut',
            timestamp: Date.now(),
            value: (await fs.promises.readFile(bodyPath)).toString(),
          },
        ]
      : [];
    const output = [...timeline, ...body];
    return output;
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return [];
  }
}

export const getResponseBodyBuffer = async (
  response?: { bodyPath?: string; bodyCompression?: Compression },
  readFailureValue?: string,
): Promise<Buffer | string> => {
  if (!response?.bodyPath) {
    // No body, so return empty Buffer
    return Buffer.alloc(0);
  }
  try {
    // TODO: unpick this read buffer so it can be used as a simple string reader
    const rawBuffer = await fs.promises.readFile(response?.bodyPath);
    if (response?.bodyCompression === 'zip') {
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
