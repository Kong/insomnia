import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Client Certificate';

export const type = 'ClientCertificate';

export const prefix = 'crt';

export const canDuplicate = true;

export const canSync = false;

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

export function init(): BaseClientCertificate {
  return {
    parentId: '',
    host: '',
    passphrase: null,
    disabled: false,
    cert: null,
    key: null,
    pfx: null,
    isPrivate: false,
  };
}

export const isClientCertificate = (model: Pick<BaseModel, 'type'>): model is ClientCertificate => (
  model.type === type
);

export function migrate(doc: ClientCertificate) {
  return doc;
}

export function create(patch: Partial<ClientCertificate> = {}) {
  if (!patch.parentId) {
    throw new Error('New ClientCertificate missing `parentId`: ' + JSON.stringify(patch));
  }

  return db.docCreate<ClientCertificate>(type, patch);
}

export function update(
  cert: ClientCertificate,
  patch: Partial<ClientCertificate> = {},
) {
  return db.docUpdate<ClientCertificate>(cert, patch);
}

export function getById(id: string) {
  return db.get<ClientCertificate>(type, id);
}

export function findByParentId(parentId: string) {
  return db.find<ClientCertificate>(type, { parentId });
}

export function remove(cert: ClientCertificate) {
  return db.remove(cert);
}

export function all() {
  return db.all<ClientCertificate>(type);
}
