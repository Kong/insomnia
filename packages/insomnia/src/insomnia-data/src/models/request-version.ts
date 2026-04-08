import type { BaseModel } from '~/models/types';

export const name = 'Request Version';
export const type = 'RequestVersion';
export const prefix = 'rvr';
export const canDuplicate = false;
export const canSync = false;

export interface BaseRequestVersion {
  compressedRequest: string | null;
}

export type RequestVersion = BaseModel & BaseRequestVersion;

export const isRequestVersion = (model: Pick<BaseModel, 'type'>): model is RequestVersion => model.type === type;

export function init() {
  return {
    compressedRequest: null,
  };
}
