// @flow
import type { ResponseHeader } from '../../models/response';
import * as models from '../../models/index';
import fs from 'fs';
import { Readable } from 'stream';

type MaybeResponse = {
  parentId?: string,
  statusCode?: number,
  statusMessage?: string,
  bytesRead?: number,
  bytesContent?: number,
  bodyPath?: string,
  elapsedTime?: number,
  headers?: Array<ResponseHeader>
};

export function init(response: MaybeResponse): { response: Object } {
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
      getRequestId(): string {
        return response.parentId || '';
      },
      getStatusCode(): number {
        return response.statusCode || 0;
      },
      getStatusMessage(): string {
        return response.statusMessage || '';
      },
      getBytesRead(): number {
        return response.bytesRead || 0;
      },
      getTime(): number {
        return response.elapsedTime || 0;
      },
      getBody(): Buffer | null {
        return models.response.getBodyBuffer(response);
      },
      getBodyStream(): Readable | null {
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
      getHeader(name: string): string | Array<string> | null {
        const headers = response.headers || [];
        const matchedHeaders = headers.filter(
          h => h.name.toLowerCase() === name.toLowerCase()
        );
        if (matchedHeaders.length > 1) {
          return matchedHeaders.map(h => h.value);
        } else if (matchedHeaders.length === 1) {
          return matchedHeaders[0].value;
        } else {
          return null;
        }
      },
      hasHeader(name: string): boolean {
        return this.getHeader(name) !== null;
      }
    }
  };
}
