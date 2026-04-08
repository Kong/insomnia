import type { BaseModel } from '~/models/types';

export const name = 'Folder Meta';

export const type = 'RequestGroupMeta';

export const prefix = 'fldm';

export const canDuplicate = false;

export const canSync = false;

interface BaseRequestGroupMeta {
  collapsed: boolean;
}

export type RequestGroupMeta = BaseModel & BaseRequestGroupMeta;

export const isRequestGroupMeta = (model: Pick<BaseModel, 'type'>): model is RequestGroupMeta => model.type === type;

export function init() {
  return {
    parentId: null,
    collapsed: false,
  };
}
