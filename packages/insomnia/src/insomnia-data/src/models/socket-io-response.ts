import type { BaseModel } from './base-types';

export const name = 'SocketIO Response';

export const type = 'SocketIOResponse';

export const prefix = 'socketIO-res';

export const canDuplicate = false;

export const canSync = false;

export interface BaseSocketIOResponse {
  // Event logs are stored on the filesystem
  eventLogPath: string;
  // Actual timelines are stored on the filesystem
  timelinePath: string;
  requestVersionId: string | null;
  environmentId: string | null;
  elapsedTime: number;
  error: string;
  url: string;
}

export type SocketIOResponse = BaseModel & BaseSocketIOResponse;

export const isSocketIOResponse = (model: Pick<BaseModel, 'type'>): model is SocketIOResponse => model.type === type;

export function init(): BaseSocketIOResponse {
  return {
    timelinePath: '',
    eventLogPath: '',
    requestVersionId: null,
    environmentId: null,
    elapsedTime: 0,
    error: '',
    url: '',
  };
}
