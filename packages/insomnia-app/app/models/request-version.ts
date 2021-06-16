import deepEqual from 'deep-equal';
import * as models from './index';
import { database as db } from '../common/database';
import { compressObject, decompressObject } from '../common/misc';
import type { BaseModel } from './index';
import { isRequest, Request } from './request';

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
];

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

export async function create(request: Request) {
  if (!isRequest(request)) {
    throw new Error(`New ${type} was not given a valid ${models.request.type} instance`);
  }

  const parentId = request._id;
  const latestRequestVersion: RequestVersion | null = await getLatestByParentId(parentId);
  const latestRequest = latestRequestVersion
    ? decompressObject(latestRequestVersion.compressedRequest)
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

  const requestPatch = decompressObject(requestVersion.compressedRequest);
  const originalRequest = await models.request.getById(requestPatch._id);

  if (!originalRequest) {
    return null;
  }

  // Only restore fields that aren't blacklisted
  for (const field of FIELDS_TO_IGNORE) {
    delete requestPatch[field];
  }

  return models.request.update(originalRequest, requestPatch);
}

function _diffRequests(rOld: Request | null, rNew: Request) {
  if (!rOld) {
    return true;
  }

  for (const key of Object.keys(rOld)) {
    // Skip fields that aren't useful
    if (FIELDS_TO_IGNORE.includes(key)) {
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
