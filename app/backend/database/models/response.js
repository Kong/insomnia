import * as db from '../index';

export const type = 'Response';
export const prefix = 'res';
export function init () {
  return db.initModel({
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
  })
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
