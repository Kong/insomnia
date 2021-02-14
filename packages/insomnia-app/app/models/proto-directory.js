// @flow
import * as db from '../common/database';
import type { BaseModel } from './index';
import { generateId } from '../common/misc';

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

export function createId(): string {
  return generateId(prefix);
}

export function create(patch: $Shape<ProtoDirectory> = {}): Promise<ProtoDirectory> {
  if (!patch.parentId) {
    throw new Error('New ProtoDirectory missing `parentId`');
  }

  return db.docCreate(type, patch);
}

export function getById(_id: string): Promise<ProtoDirectory | null> {
  return db.getWhere(type, { _id });
}

export function getByParentId(parentId: string): Promise<ProtoDirectory | null> {
  return db.getWhere(type, { parentId });
}

export function remove(obj: ProtoDirectory): Promise<void> {
  return db.remove(obj);
}

export async function batchRemoveIds(ids: Array<string>): Promise<void> {
  const dirs = await db.find(type, { _id: { $in: ids } });
  await db.batchModifyDocs({ upsert: [], remove: dirs });
}

export function all(): Promise<Array<ProtoDirectory>> {
  return db.all(type);
}
