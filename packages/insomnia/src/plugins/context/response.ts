import fs from 'node:fs';
import type { Readable } from 'node:stream';
import zlib from 'node:zlib';

import type { ResponseHeader } from '~/insomnia-data';

interface MaybeResponse {
  parentId?: string;
  statusCode?: number;
  statusMessage?: string;
  bytesRead?: number;
  bytesContent?: number;
  bodyPath?: string;
  bodyCompression?: 'zip' | null;
  elapsedTime?: number;
  headers?: ResponseHeader[];
}

const getBodyBuffer = async (response?: MaybeResponse): Promise<Buffer> => {
  if (!response?.bodyPath) {
    return Buffer.alloc(0);
  }

  try {
    const rawBuffer = await fs.promises.readFile(response.bodyPath);
    if (response.bodyCompression === 'zip') {
      return await new Promise((resolve, reject) =>
        zlib.gunzip(rawBuffer, (err, buffer) => (err ? reject(err) : resolve(buffer))),
      );
    }

    return rawBuffer;
  } catch {
    return Buffer.alloc(0);
  }
};

const getBodyStream = (response?: MaybeResponse): Readable | null => {
  if (!response?.bodyPath) {
    return null;
  }

  try {
    fs.statSync(response.bodyPath);
  } catch {
    return null;
  }

  if (response.bodyCompression === 'zip') {
    return fs.createReadStream(response.bodyPath).pipe(zlib.createGunzip());
  }

  return fs.createReadStream(response.bodyPath);
};

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
        return getBodyBuffer(response);
      },

      getBodyStream() {
        return getBodyStream(response);
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
