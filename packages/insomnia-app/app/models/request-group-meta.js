import * as db from '../common/database';

export const name = 'Folder Meta';
export const type = 'RequestGroupMeta';
export const prefix = 'fldm';
export const canDuplicate = false;

export function init() {
  return {
    parentId: null,
    collapsed: false
  };
}

export function migrate(doc) {
  return doc;
}

export function create(patch = {}) {
  if (!patch.parentId) {
    throw new Error('New RequestGroupMeta missing `parentId`', patch);
  }

  return db.docCreate(type, patch);
}

export function update(requestGroupMeta, patch) {
  return db.docUpdate(requestGroupMeta, patch);
}

export function getByParentId(parentId) {
  return db.getWhere(type, { parentId });
}

export function all() {
  return db.all(type);
}
