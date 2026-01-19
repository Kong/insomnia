import fs from 'node:fs';
import type { Readable } from 'node:stream';
import zlib from 'node:zlib';

import { database as db } from '~/common/database';
import type { ResponseTimelineEntry } from '~/main/network/libcurl-promise';
import * as models from '~/models/index';
import { isMcpRequestId } from '~/models/mcp-request';
import { isMcpResponse, type McpResponse, type as mcpResponseType } from '~/models/mcp-response';
import { type Compression, isResponse, type Response, type as responseType } from '~/models/response';
import { isSocketIORequestId } from '~/models/socket-io-request';
import { isSocketIOResponse, type SocketIOResponse, type as socketIOResponseType } from '~/models/socket-io-response';
import { isWebSocketRequestId } from '~/models/websocket-request';
import {
  isWebSocketResponse,
  type as webSocketResponseType,
  type WebSocketResponse,
} from '~/models/websocket-response';
import { deserializeNDJSON } from '~/utils/ndjson';

export async function removeResponsesForRequest(requestId: string, environmentId?: string | null) {
  const settings = await models.settings.get();
  const query: Record<string, any> = {
    parentId: requestId,
  };

  // Only add if not undefined. null is not the same as undefined
  //  null: find responses sent from base environment
  //  undefined: find all responses
  if (environmentId !== undefined && settings.filterResponsesByEnv) {
    query.environmentId = environmentId;
  }

  const type = isWebSocketRequestId(requestId)
    ? webSocketResponseType
    : isSocketIORequestId(requestId)
      ? socketIOResponseType
      : isMcpRequestId(requestId)
        ? mcpResponseType
        : responseType;

  if (type === webSocketResponseType || type === socketIOResponseType || type === mcpResponseType) {
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
  if (isWebSocketResponse(response) || isSocketIOResponse(response) || isMcpResponse(response)) {
    fs.promises.unlink(response.eventLogPath);
    fs.promises.unlink(response.timelinePath);
  } else if (isResponse(response)) {
    fs.promises.unlink(response.bodyPath);
    fs.promises.unlink(response.timelinePath);
  }
  return db.remove(response);
}

export const getBodyStream = (
  response?: { bodyPath?: string; bodyCompression?: Compression },
  readFailureValue?: string,
): Readable | string | null => {
  if (!response?.bodyPath) {
    return null;
  }
  try {
    fs.statSync(response?.bodyPath);
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return readFailureValue === undefined ? null : readFailureValue;
  }
  if (response?.bodyCompression === 'zip') {
    return fs.createReadStream(response?.bodyPath).pipe(zlib.createGunzip());
  }
  return fs.createReadStream(response?.bodyPath);
};

export const readCurlResponse = async (options: { bodyPath?: string; bodyCompression?: Compression }) => {
  const readFailureMsg = '[main/curlBridgeAPI] failed to read response body message';
  const bodyBufferOrErrMsg = await getBodyBuffer(options, readFailureMsg);
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

export function getTimeline(response: Response, showBody?: boolean) {
  const { timelinePath, bodyPath } = response;

  if (!timelinePath) {
    return [];
  }

  try {
    const rawBuffer = fs.readFileSync(timelinePath);
    const timelineString = rawBuffer.toString();
    const timeline = deserializeNDJSON(timelineString);

    const body: ResponseTimelineEntry[] = showBody
      ? [
          {
            name: 'DataOut',
            timestamp: Date.now(),
            value: fs.readFileSync(bodyPath).toString(),
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

export const getBodyBuffer = async (
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
