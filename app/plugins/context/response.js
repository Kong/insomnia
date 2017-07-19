// @flow
import type {Plugin} from '../';

type MaybeResponse = {
  parentId?: string,
  statusCode?: number,
  statusMessage?: string,
  bytesRead?: number,
  elapsedTime?: number,
}

export function init (
  plugin: Plugin,
  response: MaybeResponse,
  bodyBuffer: Buffer | null = null
): {response: Object} {
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
      getRequestId (): string {
        return response.parentId || '';
      },
      getStatusCode (): number {
        return response.statusCode || 0;
      },
      getStatusMessage (): string {
        return response.statusMessage || '';
      },
      getBytesRead (): number {
        return response.bytesRead || 0;
      },
      getTime (): number {
        return response.elapsedTime || 0;
      },
      getBody (): Buffer | null {
        return bodyBuffer;
      }
    }
  };
}
