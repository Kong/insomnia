import deepEqual from 'deep-equal';

import { database as db } from '../common/database';
import { compressObject, decompressObject } from '../common/misc';
import * as requestOperations from '../models/helpers/request-operations';
import { GrpcRequest } from './grpc-request';
import type { BaseModel } from './index';
import { isRequest, Request } from './request';
import { isWebSocketRequest, WebSocketRequest } from './websocket-request';

export const name = 'Request Version';

export const type = 'RequestVersion';

export const prefix = 'rvr';

export const canDuplicate = false;

export const canSync = false;

interface BaseRequestVersion {
  compressedRequest: string | null;
}

export type RequestVersion = BaseModel & BaseRequestVersion;

const FIELDS_TO_IGNORE = [
  '_id',
  'type',
  'created',
  'modified',
  'metaSortKey',
  'description',
  'parentId',
  'name',
] as const;

export const isRequestVersion = (model: Pick<BaseModel, 'type'>): model is RequestVersion => (
  model.type === type
);

export function init() {
  return {
    compressedRequest: null,
  };
}

export function migrate(doc: RequestVersion) {
  return doc;
}

export function getById(id: string) {
  return db.get<RequestVersion>(type, id);
}

export function findByParentId(parentId: string) {
  return db.find<RequestVersion>(type, { parentId });
}

export async function create(request: Request | WebSocketRequest | GrpcRequest) {
  if (!isRequest(request) && !isWebSocketRequest(request)) {
    throw new Error(`New ${type} was not given a valid ${request.type} instance`);
  }

  const parentId = request._id;
  const latestRequestVersion: RequestVersion | null = await getLatestByParentId(parentId);
  const latestRequest = latestRequestVersion
    ? decompressObject<Request | WebSocketRequest>(latestRequestVersion.compressedRequest)
    : null;

  const hasChanged = _diffRequests(latestRequest, request);

  if (hasChanged || !latestRequestVersion) {
    // Create a new version if the request has been modified
    const compressedRequest = compressObject(request);
    return db.docCreate<RequestVersion>(type, {
      parentId,
      compressedRequest,
    });
  } else {
    // Re-use the latest version if not modified since
    return latestRequestVersion;
  }
}

export function getLatestByParentId(parentId: string) {
  return db.getMostRecentlyModified<RequestVersion>(type, { parentId });
}

export async function restore(requestVersionId: string) {
  const requestVersion = await getById(requestVersionId);

  // Older responses won't have versions saved with them
  if (!requestVersion) {
    return null;
  }

  const requestPatch = decompressObject<Request | WebSocketRequest | GrpcRequest>(requestVersion.compressedRequest);

  if (!requestPatch) {
    return null;
  }

  const originalRequest = await requestOperations.getById(requestPatch._id);

  if (!originalRequest) {
    return null;
  }

  // Only restore fields that aren't blacklisted
  for (const field of FIELDS_TO_IGNORE) {
    if (field in requestPatch) {
      delete requestPatch[field];
    }
  }

  return requestOperations.update(originalRequest, requestPatch);
}
function _diffRequests(rOld: Request | WebSocketRequest | null, rNew: Request | WebSocketRequest) {
  if (!rOld) {
    return true;
  }

  for (const key of Object.keys(rOld) as (keyof typeof rOld)[]) {
    // Skip fields that aren't useful
    if (FIELDS_TO_IGNORE.find(field => field === key)) {
      continue;
    }
    if (!deepEqual(rOld[key], rNew[key])) {
      return true;
    }
  }

  return false;
}

export function all() {
  return db.all<RequestVersion>(type);
}
