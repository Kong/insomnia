// @flow
import * as db from '../common/database';
import type { BaseModel } from './index';

export const name = 'Proto File';
export const type = 'ProtoFile';
export const prefix = 'pf';
export const canDuplicate = true;
export const canSync = true;

type BaseProtoFile = {
  name: string,
  protoText: string,
};

export type ProtoFile = BaseModel & BaseProtoFile;

export function init(): BaseProtoFile {
  return {
    name: 'New Proto File',
    protoText: '',
  };
}

export function migrate(doc: ProtoFile): ProtoFile {
  return doc;
}

export function create(patch: $Shape<ProtoFile> = {}): Promise<ProtoFile> {
  if (!patch.parentId) {
    throw new Error('New ProtoFile missing `parentId`');
  }

  return db.docCreate(type, patch);
}

export function remove(protoFile: ProtoFile): Promise<void> {
  return db.remove(protoFile);
}

export function update(protoFile: ProtoFile, patch: $Shape<ProtoFile> = {}): Promise<ProtoFile> {
  return db.docUpdate(protoFile, patch);
}

export function getById(_id: string): Promise<ProtoFile | null> {
  return db.getWhere(type, { _id });
}

export function findByParentId(parentId: string): Promise<Array<ProtoFile>> {
  return db.find(type, { parentId });
}

export function all(): Promise<Array<ProtoFile>> {
  return db.all(type);
}
