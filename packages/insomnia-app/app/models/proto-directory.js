// @flow
import * as db from '../common/database';
import type { BaseModel } from './index';

export const name = 'Proto Directory';
export const type = 'ProtoDirectory';
export const prefix = 'pd';
export const canDuplicate = true;
export const canSync = true;

type BaseProtoDirectory = {
  name: string,
};

export type ProtoDirectory = BaseModel & BaseProtoDirectory;

export function init(): BaseProtoDirectory {
  return {
    name: 'New Proto Directory',
  };
}

export function migrate(doc: ProtoDirectory): ProtoDirectory {
  return doc;
}

export function create(patch: $Shape<ProtoDirectory> = {}): Promise<ProtoDirectory> {
  if (!patch.parentId) {
    throw new Error('New ProtoDirectory missing `parentId`');
  }

  return db.docCreate(type, patch);
}

export function getByParentId(parentId: string): Promise<ProtoDirectory | null> {
  return db.getWhere(type, { parentId });
}

export function remove(obj: ProtoDirectory): Promise<void> {
  return db.remove(obj);
}

export function all(): Promise<Array<ProtoDirectory>> {
  return db.all(type);
}
