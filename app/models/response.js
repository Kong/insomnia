import * as db from '../common/database';

export const name = 'Response';
export const type = 'Response';
export const prefix = 'res';

export function init () {
  return {
    statusCode: 0,
    statusMessage: '',
    contentType: '',
    url: '',
    bytesRead: 0,
    elapsedTime: 0,
    headers: [],
    cookies: [],
    body: '',
    encoding: 'utf8', // Legacy format
    error: ''
  }
}

export function migrate (doc) {
  return doc;
}

export function create (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New Response missing `parentId`');
  }

  db.removeBulkSilently(type, {parentId: patch.parentId});
  return db.docCreate(type, patch);
}

export function getLatestByParentId (parentId) {
  return db.getMostRecentlyModified(type, {parentId});
}
