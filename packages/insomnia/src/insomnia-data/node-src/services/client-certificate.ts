import type { ClientCertificate } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const { type } = models.clientCertificate;

export function create(patch: Partial<ClientCertificate> = {}) {
  if (!patch.parentId) {
    throw new Error('New ClientCertificate missing `parentId`: ' + JSON.stringify(patch));
  }

  return db.docCreate<ClientCertificate>(type, patch);
}

export function update(cert: ClientCertificate, patch: Partial<ClientCertificate> = {}) {
  return db.docUpdate<ClientCertificate>(cert, patch);
}

export function getById(id: string) {
  return db.findOne<ClientCertificate>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<ClientCertificate>(type, { parentId });
}

export function remove(cert: ClientCertificate) {
  return db.remove(cert);
}

export function all() {
  return db.find<ClientCertificate>(type);
}
