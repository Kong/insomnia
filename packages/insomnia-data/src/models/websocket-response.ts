import type { BaseModel } from './base-types';
import type { ResponseHeader } from './response';

export const name = 'WebSocket Response';

export const type = 'WebSocketResponse';

export const prefix = 'ws-res';

export const canDuplicate = false;

export const canSync = false;

export interface BaseWebSocketResponse {
  environmentId: string | null;
  statusCode: number;
  statusMessage: string;
  httpVersion: string;
  contentType: string;
  url: string;
  elapsedTime: number;
  headers: ResponseHeader[];
  // Event logs are stored on the filesystem
  eventLogPath: string;
  // Actual timelines are stored on the filesystem
  timelinePath: string;
  error: string;
  requestVersionId: string | null;
  settingStoreCookies: boolean | null;
  settingSendCookies: boolean | null;
}

export type WebSocketResponse = BaseModel & BaseWebSocketResponse;

export const isWebSocketResponse = (model: Pick<BaseModel, 'type'>): model is WebSocketResponse => model.type === type;

export function init(): BaseWebSocketResponse {
  return {
    statusCode: 0,
    statusMessage: '',
    httpVersion: '',
    contentType: '',
    url: '',
    elapsedTime: 0,
    headers: [],
    timelinePath: '',
    eventLogPath: '',
    error: '',
    requestVersionId: null,
    settingStoreCookies: null,
    settingSendCookies: null,
    environmentId: null,
  };
}
