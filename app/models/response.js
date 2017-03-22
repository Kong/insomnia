import * as db from '../common/database';
import {MAX_RESPONSES} from '../common/constants';

export const name = 'Response';
export const type = 'Response';
export const prefix = 'res';
export const canDuplicate = false;

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
  };
}

export function migrate (doc) {
  return doc;
}

export function getById (id) {
  return db.get(type, id);
}

export function all () {
  return db.all(type);
}

export async function removeForRequest (parentId) {
  db.removeBulkSilently(type, {parentId});
}

export function findRecentForRequest (requestId, limit) {
  return db.findMostRecentlyModified(type, {parentId: requestId}, limit);
}

export async function getLatestForRequest (requestId) {
  const responses = await findRecentForRequest(requestId, 1);
  return responses[0] || null;
}

export async function create (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New Response missing `parentId`');
  }

  const {parentId} = patch;

  // Delete all other responses before creating the new one
  const allResponses = await db.findMostRecentlyModified(type, {parentId}, MAX_RESPONSES);
  const recentIds = allResponses.map(r => r._id);
  await db.removeBulkSilently(type, {parentId, _id: {$nin: recentIds}});

  // Actually create the new response
  return db.docCreate(type, patch);
}

export function getLatestByParentId (parentId) {
  return db.getMostRecentlyModified(type, {parentId});
}
