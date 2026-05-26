import type { Readable } from 'node:stream';

import type { Compression, ResponseHeader } from '~/insomnia-data';
import { services } from '~/insomnia-data';

interface MaybeResponse {
  parentId?: string;
  statusCode?: number;
  statusMessage?: string;
  bytesRead?: number;
  bytesContent?: number;
  bodyPath?: string;
  elapsedTime?: number;
  headers?: ResponseHeader[];
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

      getBody() {
        return services.helpers.getResponseBodyBuffer(response);
      },

      getBodyStream() {
        // To avoid break the plugin APIs, keep this API as synchronous and move the implementation here.
        const getResponseBodyStream = (
          response?: { bodyPath?: string; bodyCompression?: Compression },
          readFailureValue?: string,
        ): Readable | string | null => {
          if (!response?.bodyPath) {
            return null;
          }
          const fs = require('node:fs');
          const zlib = require('node:zlib');
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

        return getResponseBodyStream(response);
      },

      setBody(body: Buffer) {
        // Should never happen but just in case it does...
        if (!response.bodyPath) {
          throw new Error('Could not set body without existing body path');
        }

        const fs = require('node:fs');
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
