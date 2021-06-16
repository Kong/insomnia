import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Proto File';

export const type = 'ProtoFile';

export const prefix = 'pf';

export const canDuplicate = true;

export const canSync = true;

interface BaseProtoFile {
  name: string;
  protoText: string;
}

export type ProtoFile = BaseModel & BaseProtoFile;

export const isProtoFile = (model: Pick<BaseModel, 'type'>): model is ProtoFile => (
  model.type === type
);

export function init(): BaseProtoFile {
  return {
    name: 'New Proto File',
    protoText: '',
  };
}

export function migrate(doc: ProtoFile) {
  return doc;
}

export function create(patch: Partial<ProtoFile> = {}) {
  if (!patch.parentId) {
    throw new Error('New ProtoFile missing `parentId`');
  }

  return db.docCreate<ProtoFile>(type, patch);
}

export function remove(protoFile: ProtoFile) {
  return db.remove(protoFile);
}

export async function batchRemoveIds(ids: string[]) {
  const files = await db.find(type, {
    _id: {
      $in: ids,
    },
  });
  await db.batchModifyDocs({
    upsert: [],
    remove: files,
  });
}

export function update(protoFile: ProtoFile, patch: Partial<ProtoFile> = {}) {
  return db.docUpdate<ProtoFile>(protoFile, patch);
}

export function getById(_id: string) {
  return db.getWhere<ProtoFile>(type, { _id });
}

export function getByParentId(parentId: string) {
  return db.getWhere<ProtoFile>(type, { parentId });
}

export function findByParentId(parentId: string) {
  return db.find<ProtoFile>(type, { parentId });
}

export function all() {
  return db.all<ProtoFile>(type);
}
