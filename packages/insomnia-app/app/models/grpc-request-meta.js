// @flow
import * as db from '../common/database';
import type { BaseModel } from './index';

export const name = 'gRPC Request Meta';
export const type = 'GrpcRequestMeta';
export const prefix = 'greqm';
export const canDuplicate = false;
export const canSync = false;

type BaseGrpcRequestMeta = {
  pinned: boolean,
};

export type GrpcRequestMeta = BaseModel & BaseGrpcRequestMeta;

export function init() {
  return {
    pinned: false,
  };
}

export function migrate(doc: GrpcRequestMeta): GrpcRequestMeta {
  return doc;
}

export function create(patch: $Shape<GrpcRequestMeta> = {}): Promise<GrpcRequestMeta> {
  if (!patch.parentId) {
    throw new Error('New GrpcRequestMeta missing `parentId`');
  }

  return db.docCreate(type, patch);
}

export function update(
  requestMeta: GrpcRequestMeta,
  patch: $Shape<GrpcRequestMeta>,
): Promise<GrpcRequestMeta> {
  return db.docUpdate(requestMeta, patch);
}

export function getByParentId(parentId: string): Promise<GrpcRequestMeta> {
  return db.getWhere(type, { parentId });
}

export async function getOrCreateByParentId(parentId: string): Promise<GrpcRequestMeta> {
  const requestMeta = await getByParentId(parentId);

  if (requestMeta) {
    return requestMeta;
  }

  return create({ parentId });
}

export function all(): Promise<Array<GrpcRequestMeta>> {
  return db.all(type);
}
