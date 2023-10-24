import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Request Bin';

export const type = 'RequestBin';

export const prefix = 'bin';

export const canDuplicate = true;

export const canSync = true;

export interface BaseRequestBin {
  url: string;
  remoteId: string;
}

export type RequestBin = BaseModel & BaseRequestBin;

export const isRequestBin = (model: Pick<BaseModel, 'type'>): model is RequestBin => (
  model.type === type
);

export function init(): BaseRequestBin {
  return {
    url: '',
    remoteId: '',
  };
}

export function migrate(doc: RequestBin) {
  return doc;
}

export function getByParentId(parentId: string) {
  return db.getWhere<RequestBin>(type, { parentId });
}

export function findByParentId(parentId: string) {
  return db.find<RequestBin>(type, { parentId });
}

export async function all() {
  return db.all<RequestBin>(type);
}

export function update(requestBin: RequestBin, patch: Partial<RequestBin> = {}) {
  return db.docUpdate(requestBin, patch);
}

export function removeWhere(parentId: string) {
  return db.removeWhere(type, { parentId });
}
