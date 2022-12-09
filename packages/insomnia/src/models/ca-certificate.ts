import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'CA Certificate';

export const type = 'CaCertificate';

export const prefix = 'crt';

export const canDuplicate = true;

export const canSync = false;

interface BaseCaCertificate {
  parentId: string;
  pem: string | null;
  disabled: boolean;
  // For sync control
  isPrivate: boolean;
}

export type CaCertificate = BaseModel & BaseCaCertificate;

export function init(): BaseCaCertificate {
  return {
    parentId: '',
    disabled: false,
    pem: null,
    isPrivate: false,
  };
}

export const isCaCertificate = (model: Pick<BaseModel, 'type'>): model is CaCertificate => (
  model.type === type
);

export async function migrate(doc: CaCertificate) {
  return doc;
}

export function create(patch: Partial<CaCertificate> = {}) {
  if (!patch.parentId) {
    throw new Error('New CaCertificate missing `parentId`: ' + JSON.stringify(patch));
  }

  return db.docCreate<CaCertificate>(type, patch);
}

export function update(
  cert: CaCertificate,
  patch: Partial<CaCertificate> = {},
) {
  return db.docUpdate<CaCertificate>(cert, patch);
}

export function getById(id: string) {
  return db.get<CaCertificate>(type, id);
}

export function findByParentId(parentId: string) {
  return db.getWhere<CaCertificate>(type, { parentId });
}

export function remove(cert: CaCertificate) {
  return db.remove(cert);
}

export function all() {
  return db.all<CaCertificate>(type);
}
