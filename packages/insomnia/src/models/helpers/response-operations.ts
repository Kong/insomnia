import type { Readable } from 'node:stream';

import { database as db } from '~/common/database';
import type { Compression, McpResponse, Response, SocketIOResponse, WebSocketResponse } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import type { ResponseTimelineEntry } from '~/main/network/libcurl-promise';
import * as models from '~/models/index';
import { deserializeNDJSON } from '~/utils/ndjson';

const { isResponse, type: responseType } = models.response;

export async function removeResponsesForRequest(requestId: string, environmentId?: string | null) {
  const settings = await services.settings.get();
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
      window.main.deleteFile({ path: doc.eventLogPath });
      window.main.deleteFile({ path: doc.timelinePath });
    }
  } else if (type === responseType) {
    const toDelete = await db.find<Response>(type, query);
    for (const doc of toDelete) {
      window.main.deleteFile({ path: doc.bodyPath });
      window.main.deleteFile({ path: doc.timelinePath });
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
    window.main.deleteFile({ path: response.eventLogPath });
    window.main.deleteFile({ path: response.timelinePath });
  } else if (isResponse(response)) {
    window.main.deleteFile({ path: response.bodyPath });
    window.main.deleteFile({ path: response.timelinePath });
  }
  return db.remove(response);
}

// getBodyStream is only called from main-process plugin code — dynamic imports keep
// node:fs and node:zlib out of the renderer bundle.
export const getBodyStream = (
  response?: { bodyPath?: string; bodyCompression?: Compression },
  readFailureValue?: string,
): Readable | string | null => {
  if (!response?.bodyPath) {
    return null;
  }
  const modulePath = 'node:fs';
  const fs = require(modulePath);
  try {
    fs.statSync(response.bodyPath);
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return readFailureValue === undefined ? null : readFailureValue;
  }
  if (response.bodyCompression === 'zip') {
    const zlibPath = 'node:zlib';
    const zlib = require(zlibPath);
    return fs.createReadStream(response.bodyPath).pipe(zlib.createGunzip());
  }
  return fs.createReadStream(response.bodyPath);
};

export const readCurlResponse = async (options: { bodyPath?: string; bodyCompression?: Compression }) => {
  const readFailureMsg = '[main/curlBridgeAPI] failed to read response body message';
  const bodyBufferOrErrMsg = await getBodyBuffer(options, readFailureMsg);

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

export async function getTimeline(response: Response, showBody?: boolean): Promise<ResponseTimelineEntry[]> {
  const { timelinePath, bodyPath } = response;

  if (!timelinePath) {
    return [];
  }

  try {
    const timelineString = await window.main.insecureReadFile({ path: timelinePath });
    const timeline = deserializeNDJSON(timelineString);

    const body: ResponseTimelineEntry[] = showBody
      ? [
          {
            name: 'DataOut',
            timestamp: Date.now(),
            value: await window.main.insecureReadFile({ path: bodyPath }),
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
    const content = await window.main.insecureReadFile({ path: response.bodyPath });
    const rawBuffer = Buffer.from(content, 'binary');
    if (response.bodyCompression === 'zip') {
      const ds = new DecompressionStream('gzip');
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      writer.write(rawBuffer);
      writer.close();
      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (value) {
          chunks.push(value);
        }
        done = d;
      }
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
      }
      return Buffer.from(out);
    }
    return rawBuffer;
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return readFailureValue === undefined ? Buffer.alloc(0) : readFailureValue;
  }
};
