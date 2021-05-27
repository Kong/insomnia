import { database as db } from '../common/database';
import type { BaseModel } from './index';
import { generateId } from '../common/misc';

export const name = 'Space';
export const type = 'Space';
export const prefix = 'sp';
export const canDuplicate = false;
export const canSync = false;

interface BaseSpace {
  name: string;
}

export type Space = BaseModel & BaseSpace;

export function init(): BaseSpace {
  return {
    name: 'My Space',
  };
}

export function migrate(doc: Space) {
  return doc;
}

export function createId() {
  return generateId(prefix);
}

export function create(patch: Partial<Space> = {}) {
  return db.docCreate<Space>(type, patch);
}

export function getById(_id: string) {
  return db.getWhere<Space>(type, { _id });
}

export function remove(obj: Space) {
  return db.remove(obj);
}

export function all() {
  return db.all<Space>(type);
}
