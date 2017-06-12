import zlib from 'zlib';
import deepEqual from 'deep-equal';
import * as models from './index';
import * as db from '../common/database';
export const name = 'Request Version';
export const type = 'RequestVersion';
export const prefix = 'rvr';
export const canDuplicate = false;

const FIELDS_TO_IGNORE_IN_REQUEST_DIFF = [
  '_id',
  'type',
  'created',
  'modified',
  'metaSortKey',
  'description',
  'name'
];

export function init () {
  return {
    compressedRequest: null
  };
}

export function migrate (doc) {
  return doc;
}

export function getById (id) {
  return db.get(type, id);
}

export async function create (request) {
  if (!request.type === models.request.type) {
    throw new Error(`New ${type} was not given a valid ${models.request.type} instance`);
  }

  const parentId = request._id;
  const latestRequestVersion = await getLatestByParentId(parentId);
  const latestRequest = latestRequestVersion
    ? await _decompressRequest(latestRequestVersion.compressedRequest)
    : null;

  const hasChanged = _diffRequests(latestRequest, request);
  if (hasChanged) {
    // Create a new version if the request has been modified
    const compressedRequest = await _compressRequest(request);
    return db.docCreate(type, {parentId, compressedRequest});
  } else {
    // Re-use the latest version if not modified since
    return latestRequestVersion;
  }
}

export function getLatestByParentId (parentId) {
  return db.getMostRecentlyModified(type, {parentId});
}

export async function restore (requestVersionId) {
  const requestVersion = await getById(requestVersionId);

  // Older responses won't have versions saved with them
  if (!requestVersion) {
    return null;
  }

  const request = await _decompressRequest(requestVersion.compressedRequest);
  return models.request.update(request);
}

function _diffRequests (rOld, rNew) {
  if (!rOld) {
    return true;
  }

  for (const key of Object.keys(rOld)) {
    // Skip fields that aren't useful
    if (FIELDS_TO_IGNORE_IN_REQUEST_DIFF.includes(key)) {
      continue;
    }

    if (!deepEqual(rOld[key], rNew[key])) {
      return true;
    }
  }

  return false;
}

function _compressRequest (request) {
  return new Promise((resolve, reject) => {
    const str = JSON.stringify(request);
    zlib.gzip(str, {}, (err, buffer) => {
      if (err) {
        reject(err);
      } else {
        const encoded = buffer.toString('base64');
        resolve(encoded);
      }
    });
  });
}

function _decompressRequest (requestJson) {
  return new Promise((resolve, reject) => {
    const buffer = Buffer.from(requestJson, 'base64');
    zlib.gunzip(buffer, {}, (err, jsonStr) => {
      if (err) {
        reject(err);
      } else {
        const obj = JSON.parse(jsonStr);
        resolve(obj);
      }
    });
  });
}
