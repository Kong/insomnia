import { database as db } from '../common/database';
import { isGrpcRequestId } from './grpc-request';
import type { BaseModel } from './index';

export const name = 'gRPC Request Meta';

export const type = 'GrpcRequestMeta';

export const prefix = 'greqm';

export const canDuplicate = false;

export const canSync = false;

interface BaseGrpcRequestMeta {
  pinned: boolean;
  lastActive: number;
}

export type GrpcRequestMeta = BaseModel & BaseGrpcRequestMeta;

export const isGrpcRequestMeta = (model: Pick<BaseModel, 'type'>): model is GrpcRequestMeta => (
  model.type === type
);

export function init() {
  return {
    pinned: false,
    lastActive: 0,
  };
}

export function migrate(doc: GrpcRequestMeta) {
  return doc;
}

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
  return db.getWhere<GrpcRequestMeta>(type, { parentId });
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
  } else {
    const newPatch = Object.assign(
      {
        parentId,
      },
      patch,
    );
    return create(newPatch);
  }
}

export function all() {
  return db.all<GrpcRequestMeta>(type);
}

function expectParentToBeGrpcRequest(parentId: string | null) {
  if (!isGrpcRequestId(parentId)) {
    throw new Error('Expected the parent of GrpcRequestMeta to be a GrpcRequest');
  }
}
