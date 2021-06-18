import { database as db } from '../common/database';
import type { BaseModel } from './index';
import { generateId } from '../common/misc';

export const name = 'Space';
export const type = 'Space';
export const prefix = 'sp';
export const canDuplicate = false;
export const canSync = false;

// A base space represents "no" space, when viewing this base space fetch all workspaces with no parent.
// Using this instead of null.
export const BASE_SPACE_ID = 'base-space';

interface BaseSpace {
  name: string;
  remoteId: string | null;
}

export type Space = BaseModel & BaseSpace;

export const isSpace = (model: Pick<BaseModel, 'type'>): model is Space => (
  model.type === type
);

export const isSpaceId = (id: string | null) => (
  id?.startsWith(`${prefix}_`)
);

export function init(): BaseSpace {
  return {
    name: 'My Space',
    remoteId: null, // `null` is necessary for the model init logic to work properly
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

export function update(space: Space, patch: Partial<Space>) {
  return db.docUpdate(space, patch);
}

export function all() {
  return db.all<Space>(type);
}
