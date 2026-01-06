import { databaseSchema } from '~/models/schema';

import { database as db } from '../common/database';
import { generateId } from '../common/misc';
import type { BaseModel } from './index';

const type = databaseSchema.ProtoDirectory.type;

interface BaseProtoDirectory {
  name: string;
}

export type ProtoDirectory = BaseModel & BaseProtoDirectory;

export const isProtoDirectory = (model: Pick<BaseModel, 'type'>): model is ProtoDirectory => model.type === type;

export function createId() {
  return generateId(databaseSchema.ProtoDirectory.prefix);
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
