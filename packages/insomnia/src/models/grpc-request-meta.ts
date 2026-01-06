import { databaseSchema } from '~/models/schema';

import { database as db } from '../common/database';
import { isGrpcRequestId } from './grpc-request';
import type { BaseModel } from './index';

const type = databaseSchema.GrpcRequestMeta.type;

interface BaseGrpcRequestMeta {
  pinned: boolean;
  lastActive: number;
}

export type GrpcRequestMeta = BaseModel & BaseGrpcRequestMeta;

export const isGrpcRequestMeta = (model: Pick<BaseModel, 'type'>): model is GrpcRequestMeta => model.type === type;

export function create(patch: Partial<GrpcRequestMeta> = {}) {
  if (!patch.parentId) {
    throw new Error('New GrpcRequestMeta missing `parentId`');
  }

  expectParentToBeGrpcRequest(patch.parentId);
  return db.docCreate<GrpcRequestMeta>(type, patch);
}

export function update(requestMeta: GrpcRequestMeta, patch: Partial<GrpcRequestMeta>) {
  expectParentToBeGrpcRequest(patch.parentId || requestMeta.parentId);
  return db.docUpdate(requestMeta, patch);
}

export function getByParentId(parentId: string) {
  expectParentToBeGrpcRequest(parentId);
  return db.findOne<GrpcRequestMeta>(type, { parentId });
}

export async function getOrCreateByParentId(parentId: string) {
  const requestMeta = await getByParentId(parentId);

  if (requestMeta) {
    return requestMeta;
  }

  return create({ parentId });
}

export async function updateOrCreateByParentId(parentId: string, patch: Partial<GrpcRequestMeta>) {
  const requestMeta = await getByParentId(parentId);

  if (requestMeta) {
    return update(requestMeta, patch);
  }
  const newPatch = Object.assign(
    {
      parentId,
    },
    patch,
  );
  return create(newPatch);
}

export function all() {
  return db.find<GrpcRequestMeta>(type);
}

function expectParentToBeGrpcRequest(parentId: string | null) {
  if (!isGrpcRequestId(parentId)) {
    throw new Error('Expected the parent of GrpcRequestMeta to be a GrpcRequest');
  }
}
