import { database as db } from '../../src/database';
import { models } from '../../src/models';
import { type GrpcRequest } from '../../src/models/types';

const { type, name } = models.grpcRequest;

export function create(patch: Partial<GrpcRequest> = {}) {
  if (!patch.parentId) {
    throw new Error('New GrpcRequest missing `parentId`');
  }

  return db.docCreate<GrpcRequest>(type, patch);
}

export function remove(obj: GrpcRequest) {
  return db.remove(obj);
}

export function update(obj: GrpcRequest, patch: Partial<GrpcRequest> = {}) {
  return db.docUpdate(obj, patch);
}

export function getById(_id: string) {
  return db.findOne<GrpcRequest>(type, { _id });
}

export function findByProtoFileId(protoFileId: string) {
  return db.find<GrpcRequest>(type, { protoFileId });
}

export function findByParentId(parentId: string) {
  return db.find<GrpcRequest>(type, { parentId });
}

// This is duplicated (lol) from models/request.js
export async function duplicate(request: GrpcRequest, patch: Partial<GrpcRequest> = {}) {
  // Only set name and "(Copy)" if the patch does
  // not define it and the request itself has a name.
  // Otherwise leave it blank so the request URL can
  // fill it in automatically.
  if (!patch.name && request.name) {
    patch.name = `${request.name} (Copy)`;
  }

  // Get sort key of next request
  const q = {
    metaSortKey: {
      $gt: request.metaSortKey,
    },
  };

  const [nextRequest] = await db.find<GrpcRequest>(type, q, {
    metaSortKey: 1,
  });
  const nextSortKey = nextRequest ? nextRequest.metaSortKey : request.metaSortKey + 100;
  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - request.metaSortKey) / 2;
  const metaSortKey = request.metaSortKey + sortKeyIncrement;
  return db.duplicate<GrpcRequest>(request, {
    name,
    metaSortKey,
    ...patch,
  });
}

export function all() {
  return db.find<GrpcRequest>(type);
}
