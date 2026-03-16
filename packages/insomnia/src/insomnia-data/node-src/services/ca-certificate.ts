import { database as db } from '../../src/database';
import { models } from '../../src/models';
import { type CaCertificate } from '../../src/models/types';

export const { type } = models.caCertificate;

export function create(patch: Partial<CaCertificate> = {}) {
  if (!patch.parentId) {
    throw new Error('New CaCertificate missing `parentId`: ' + JSON.stringify(patch));
  }

  return db.docCreate<CaCertificate>(type, patch);
}

export function update(cert: CaCertificate, patch: Partial<CaCertificate> = {}) {
  return db.docUpdate<CaCertificate>(cert, patch);
}

export function getById(id: string) {
  return db.findOne<CaCertificate>(type, { _id: id });
}

export function getByParentId(parentId: string) {
  return db.findOne<CaCertificate>(type, { parentId });
}

export function removeWhere(parentId: string) {
  return db.removeWhere(type, { parentId });
}

export function all() {
  return db.find<CaCertificate>(type);
}
