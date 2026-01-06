import { databaseSchema } from '~/models/schema';

import { database as db } from '../common/database';
import type { BaseModel } from './index';
const type = databaseSchema.ClientCertificate.type;

interface BaseClientCertificate {
  parentId: string;
  host: string;
  passphrase: string | null;
  cert: string | null;
  key: string | null;
  pfx: string | null;
  disabled: boolean;
  // For sync control
  isPrivate: boolean;
}

export type ClientCertificate = BaseModel & BaseClientCertificate;

export const isClientCertificate = (model: Pick<BaseModel, 'type'>): model is ClientCertificate => model.type === type;

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
