import { getAppName } from '../common/constants';
import { database as db } from '../common/database';
import { generateId } from '../common/misc';
import type { BaseModel } from './index';

export const name = 'Space';
export const type = 'Space';
export const prefix = 'sp';
export const canDuplicate = false;
export const canSync = false;

export const BASE_SPACE_ID = `${prefix}_base-space`;

export const isBaseSpace = (space: Space) => space._id === BASE_SPACE_ID;
export const isNotBaseSpace = (space: Space) => !isBaseSpace(space);
export const isLocalSpace = (space: Space): space is LocalSpace => space.remoteId === null;
export const isRemoteSpace = (space: Space): space is RemoteSpace => !isLocalSpace(space);
export const spaceHasSettings = (space: Space) => isLocalSpace(space) && !isBaseSpace(space);

interface CommonSpace {
  name: string;
}

export interface RemoteSpace extends BaseModel, CommonSpace {
  remoteId: string;
}

export interface LocalSpace extends BaseModel, CommonSpace {
  remoteId: null;
}

export type Space = LocalSpace | RemoteSpace;

export const isSpace = (model: Pick<BaseModel, 'type'>): model is Space => (
  model.type === type
);

export const isSpaceId = (id: string | null) => (
  id?.startsWith(`${prefix}_`)
);

export function init(): Partial<Space> {
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

export async function all() {
  const spaces = await db.all<Space>(type);

  if (!spaces.find(c => c._id === BASE_SPACE_ID)) {
    await create({ _id: BASE_SPACE_ID, name: getAppName(), remoteId: null });
    return db.all<Space>(type);
  }

  return spaces;
}
