import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Folder Meta';

export const type = 'RequestGroupMeta';

export const prefix = 'fldm';

export const canDuplicate = false;

export const canSync = false;

interface BaseRequestGroupMeta {
  collapsed: boolean;
}

export type RequestGroupMeta = BaseModel & BaseRequestGroupMeta;

export const isRequestGroupMeta = (model: Pick<BaseModel, 'type'>): model is RequestGroupMeta => (
  model.type === type
);

export function init() {
  return {
    parentId: null,
    collapsed: false,
  };
}

export function migrate(doc: RequestGroupMeta) {
  return doc;
}

export function create(patch: Partial<RequestGroupMeta> = {}) {
  if (!patch.parentId) {
    throw new Error('New RequestGroupMeta missing `parentId`: ' + JSON.stringify(patch));
  }

  return db.docCreate<RequestGroupMeta>(type, patch);
}

export function update(requestGroupMeta: RequestGroupMeta, patch: Partial<RequestGroupMeta>) {
  return db.docUpdate<RequestGroupMeta>(requestGroupMeta, patch);
}

export function getByParentId(parentId: string) {
  return db.getWhere<RequestGroupMeta>(type, { parentId });
}

export function all() {
  return db.all<RequestGroupMeta>(type);
}
