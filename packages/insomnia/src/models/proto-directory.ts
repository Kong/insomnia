import { database as db } from '../common/database';
import { generateId } from '../common/misc';
import type { BaseModel } from './index';

export const name = 'Proto Directory';

export const type = 'ProtoDirectory';

export const prefix = 'pd';

export const canDuplicate = true;

export const canSync = true;

interface BaseProtoDirectory {
  name: string;
}

export type ProtoDirectory = BaseModel & BaseProtoDirectory;

export const isProtoDirectory = (model: Pick<BaseModel, 'type'>): model is ProtoDirectory => model.type === type;

export function init(): BaseProtoDirectory {
  return {
    name: 'New Proto Directory',
  };
}

export function migrate(doc: ProtoDirectory) {
  return doc;
}

export function createId() {
  return generateId(prefix);
}

export function create(patch: Partial<ProtoDirectory> = {}) {
  if (!patch.parentId) {
    throw new Error('New ProtoDirectory missing `parentId`');
  }

  return db.docCreate<ProtoDirectory>(type, patch);
}

export function getById(_id: string) {
  return db.findOne<ProtoDirectory>(type, { _id });
}

export function getByParentId(parentId: string) {
  return db.findOne<ProtoDirectory>(type, { parentId });
}

export function findByParentId(parentId: string) {
  return db.find<ProtoDirectory>(type, { parentId });
}

export function remove(obj: ProtoDirectory) {
  return db.remove(obj);
}

export function all() {
  return db.find<ProtoDirectory>(type);
}
