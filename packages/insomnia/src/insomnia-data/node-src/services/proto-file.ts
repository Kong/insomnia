import type { ProtoFile } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const { type } = models.protoFile;

export function create(patch: Partial<ProtoFile> = {}) {
  if (!patch.parentId) {
    throw new Error('New ProtoFile missing `parentId`');
  }

  return db.docCreate<ProtoFile>(type, patch);
}

export function remove(protoFile: ProtoFile) {
  return db.remove(protoFile);
}

export function update(protoFile: ProtoFile, patch: Partial<ProtoFile> = {}) {
  return db.docUpdate<ProtoFile>(protoFile, patch);
}

export function getById(_id: string) {
  return db.findOne<ProtoFile>(type, { _id });
}

export function getByParentId(parentId: string) {
  return db.findOne<ProtoFile>(type, { parentId });
}

export function findByParentId(parentId: string) {
  return db.find<ProtoFile>(type, { parentId });
}

export function all() {
  return db.find<ProtoFile>(type);
}
