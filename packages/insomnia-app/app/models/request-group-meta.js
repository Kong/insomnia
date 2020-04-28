// @flow

import * as db from '../common/database';
import type { BaseModel } from './index';

export const name = 'Folder Meta';
export const type = 'RequestGroupMeta';
export const prefix = 'fldm';
export const canDuplicate = false;
export const canSync = false;

type BaseRequestGroupMeta = {
  collapsed: boolean,
};

export type RequestGroupMeta = BaseModel & BaseRequestGroupMeta;

export function init() {
  return {
    parentId: null,
    collapsed: false,
  };
}

export function migrate(doc: RequestGroupMeta): RequestGroupMeta {
  return doc;
}

export function create(patch: $Shape<RequestGroupMeta> = {}): Promise<RequestGroupMeta> {
  if (!patch.parentId) {
    throw new Error('New RequestGroupMeta missing `parentId`: ' + JSON.stringify(patch));
  }

  return db.docCreate(type, patch);
}

export function update(
  requestGroupMeta: RequestGroupMeta,
  patch: $Shape<RequestGroupMeta>,
): Promise<RequestGroupMeta> {
  return db.docUpdate(requestGroupMeta, patch);
}

export function getByParentId(parentId: string): Promise<RequestGroupMeta | null> {
  return db.getWhere(type, { parentId });
}

export function all(): Promise<Array<RequestGroupMeta>> {
  return db.all(type);
}
