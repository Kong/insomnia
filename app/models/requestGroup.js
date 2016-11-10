import * as db from '../common/database';

export const type = 'RequestGroup';
export const prefix = 'fld';
export function init () {
  return {
    name: 'New Folder',
    environment: {},
    metaCollapsed: false,
    metaSortKey: -1 * Date.now()
  }
}

export function create (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New Requests missing `parentId`', patch);
  }

  return db.docCreate(type, patch);
}

export function update (requestGroup, patch) {
  return db.docUpdate(requestGroup, patch);
}

export function getById (id) {
  return db.get(type, id);
}

export function findByParentId (parentId) {
  return db.find(type, {parentId})
}

export function remove (requestGroup) {
  return db.remove(requestGroup);
}

export function all () {
  return db.all(type);
}

export function duplicate (requestGroup) {
  const name = `${requestGroup.name} (Copy)`;
  return db.duplicate(requestGroup, {name});
}
