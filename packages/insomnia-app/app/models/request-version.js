import deepEqual from 'deep-equal';
import * as models from './index';
import * as db from '../common/database';
import { compressObject, decompressObject } from '../common/misc';
export const name = 'Request Version';
export const type = 'RequestVersion';
export const prefix = 'rvr';
export const canDuplicate = false;

const FIELDS_TO_IGNORE = [
  '_id',
  'type',
  'created',
  'modified',
  'metaSortKey',
  'description',
  'parentId',
  'name'
];

export function init() {
  return {
    compressedRequest: null
  };
}

export function migrate(doc) {
  return doc;
}

export function getById(id) {
  return db.get(type, id);
}

export async function create(request) {
  if (!request.type === models.request.type) {
    throw new Error(
      `New ${type} was not given a valid ${models.request.type} instance`
    );
  }

  const parentId = request._id;
  const latestRequestVersion = await getLatestByParentId(parentId);
  const latestRequest = latestRequestVersion
    ? decompressObject(latestRequestVersion.compressedRequest)
    : null;

  const hasChanged = _diffRequests(latestRequest, request);
  if (hasChanged) {
    // Create a new version if the request has been modified
    const compressedRequest = compressObject(request);
    return db.docCreate(type, { parentId, compressedRequest });
  } else {
    // Re-use the latest version if not modified since
    return latestRequestVersion;
  }
}

export function getLatestByParentId(parentId) {
  return db.getMostRecentlyModified(type, { parentId });
}

export async function restore(requestVersionId) {
  const requestVersion = await getById(requestVersionId);

  // Older responses won't have versions saved with them
  if (!requestVersion) {
    return null;
  }

  const requestPatch = decompressObject(requestVersion.compressedRequest);
  const originalRequest = await models.request.getById(requestPatch._id);

  // Only restore fields that aren't blacklisted
  for (const field of FIELDS_TO_IGNORE) {
    delete requestPatch[field];
  }

  return models.request.update(originalRequest, requestPatch);
}

function _diffRequests(rOld, rNew) {
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
