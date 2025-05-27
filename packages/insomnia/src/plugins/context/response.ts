import fs from 'fs';
import zlib from 'zlib';

import * as models from '../../models/index';
import type { ResponseHeader } from '../../models/response';

export type Compression = 'zip' | null | '__NEEDS_MIGRATION__' | undefined;
interface MaybeResponse {
  parentId?: string;
  statusCode?: number;
  statusMessage?: string;
  bytesRead?: number;
  bytesContent?: number;
  bodyPath?: string;
  elapsedTime?: number;
  headers?: ResponseHeader[];
  bodyCompression?: Compression;
}

export function init(response?: MaybeResponse) {
  if (!response) {
    throw new Error('contexts.response initialized without response');
  }

  return {
    response: {
      // TODO: Make this work. Right now it doesn't because _id is
      // not generated in network.js
      // getId () {
      //   return response.parentId;
      // },

      getRequestId() {
        return response.parentId || '';
      },

      getStatusCode() {
        return response.statusCode || 0;
      },

      getStatusMessage() {
        return response.statusMessage || '';
      },

      getBytesRead() {
        return response.bytesRead || 0;
      },

      getTime() {
        return response.elapsedTime || 0;
      },

      getBody(readFailureValue?: string): Buffer | string | null {
        if (!response?.bodyPath) {
          // No body, so return empty Buffer
          return Buffer.alloc(0);
        }
        try {
          const rawBuffer = fs.readFileSync(response.bodyPath);
          if (response.bodyCompression === 'zip') {
            return zlib.gunzipSync(rawBuffer);
          }
            return rawBuffer;
        } catch (err) {
          console.warn('Failed to read response body', err.message);
          return readFailureValue === undefined ? null : readFailureValue;
        }
      },

      getBodyStream() {
        return models.response.getBodyStream(response);
      },

      setBody(body: Buffer) {
        // Should never happen but just in case it does...
        if (!response.bodyPath) {
          throw new Error('Could not set body without existing body path');
        }

        fs.writeFileSync(response.bodyPath, body);
        response.bytesContent = body.length;
      },

      getHeader(name: string): string | string[] | null {
        const headers = response.headers || [];
        const matchedHeaders = headers.filter(h => h.name.toLowerCase() === name.toLowerCase());

        if (matchedHeaders.length > 1) {
          return matchedHeaders.map(h => h.value);
        } else if (matchedHeaders.length === 1) {
          return matchedHeaders[0].value;
        }
        return null;
      },

      getHeaders() {
        return response.headers?.map(h => ({
          name: h.name,
          value: h.value,
        }));
      },

      hasHeader(name: string) {
        return this.getHeader(name) !== null;
      },
    },
  };
}
