import fs from 'fs';

import * as models from '../../models/index';
import type { ResponseHeader } from '../../models/response';

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
        return models.response.getBodyBuffer(response);
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
        } else {
          return null;
        }
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
