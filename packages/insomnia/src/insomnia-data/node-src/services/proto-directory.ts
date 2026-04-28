import type { ProtoDirectory } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const { type } = models.protoDirectory;

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
