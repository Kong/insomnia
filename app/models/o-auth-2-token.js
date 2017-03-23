import * as db from '../common/database';

export const name = 'OAuth 2.0 Token';
export const type = 'OAuth2Token';
export const prefix = 'oa2';
export const canDuplicate = false;

export function init () {
  return {
    parentId: null,
    refreshToken: null,
    accessToken: null,
    expiresAt: null, // Should be Date.now() if valid

    // Error handling
    error: null,
    errorDescription: null,
    errorUri: null
  };
}

export function migrate (doc) {
  return doc;
}

export function create (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New OAuth2Token missing `parentId`', patch);
  }

  return db.docCreate(type, patch);
}

export function update (token, patch) {
  return db.docUpdate(token, patch);
}

export function remove (token) {
  return db.remove(token);
}

export function getByParentId (parentId) {
  return db.getWhere(type, {parentId});
}

export async function getOrCreateByParentId (parentId, patch = {}) {
  let token = await db.getWhere(type, {parentId});

  if (!token) {
    token = await create({parentId}, patch);
  }

  return token;
}

export function all () {
  return db.all(type);
}
