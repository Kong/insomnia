// @flow
import * as db from '../common/database';
import type { BaseModel } from './index';

export const name = 'gRPC Request';
export const type = 'GrpcRequest';
export const prefix = 'greq';
export const canDuplicate = true;
export const canSync = true;

type RequestBody = {
  text?: string,
};

type BaseGrpcRequest = {
  name: string,
  url: string,
  description: string,
  protoFileId?: string,
  protoMethodName?: string,
  body: RequestBody,
  metaSortKey: number,
  isPrivate: boolean,
};

export type GrpcRequest = BaseModel & BaseGrpcRequest;

export function init(): BaseGrpcRequest {
  return {
    url: '',
    name: 'New gRPC Request',
    description: '',
    protoFileId: '',
    protoMethodName: '',
    body: {
      text: '{}',
    },
    metaSortKey: -1 * Date.now(),
    idPrivate: false,
  };
}

export function migrate(doc: GrpcRequest): GrpcRequest {
  return doc;
}

export function create(patch: $Shape<GrpcRequest> = {}): Promise<GrpcRequest> {
  if (!patch.parentId) {
    throw new Error('New GrpcRequest missing `parentId`');
  }

  return db.docCreate(type, patch);
}

export function remove(obj: GrpcRequest): Promise<void> {
  return db.remove(obj);
}

export function update(obj: GrpcRequest, patch: $Shape<GrpcRequest> = {}): Promise<GrpcRequest> {
  return db.docUpdate(obj, patch);
}

export function getById(_id: string): Promise<GrpcRequest | null> {
  return db.getWhere(type, { _id });
}

export function findByProtoFileId(protoFileId: string): Promise<Array<GrpcRequest>> {
  return db.find(type, { protoFileId });
}

export function findByParentId(parentId: string): Promise<Array<GrpcRequest>> {
  return db.find(type, { parentId });
}

// This is duplicated (lol) from models/request.js
export async function duplicate(
  request: GrpcRequest,
  patch: $Shape<GrpcRequest> = {},
): Promise<GrpcRequest> {
  // Only set name and "(Copy)" if the patch does
  // not define it and the request itself has a name.
  // Otherwise leave it blank so the request URL can
  // fill it in automatically.
  if (!patch.name && request.name) {
    patch.name = `${request.name} (Copy)`;
  }

  // Get sort key of next request
  const q = { metaSortKey: { $gt: request.metaSortKey } };
  const [nextRequest] = await db.find(type, q, { metaSortKey: 1 });
  const nextSortKey = nextRequest ? nextRequest.metaSortKey : request.metaSortKey + 100;

  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - request.metaSortKey) / 2;
  const metaSortKey = request.metaSortKey + sortKeyIncrement;

  return db.duplicate(request, { name, metaSortKey, ...patch });
}

export function all(): Promise<Array<GrpcRequest>> {
  return db.all(type);
}
