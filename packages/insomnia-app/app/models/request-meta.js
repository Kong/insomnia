import * as db from '../common/database';
import { PREVIEW_MODE_FRIENDLY } from '../common/constants';

export const name = 'Request Meta';
export const type = 'RequestMeta';
export const prefix = 'reqm';
export const canDuplicate = false;

export function init() {
  return {
    parentId: null,
    previewMode: PREVIEW_MODE_FRIENDLY,
    responseFilter: '',
    responseFilterHistory: [],
    activeResponseId: null,
    savedRequestBody: {}
  };
}

export function migrate(doc) {
  return doc;
}

export function create(patch = {}) {
  if (!patch.parentId) {
    throw new Error('New RequestMeta missing `parentId`', patch);
  }

  return db.docCreate(type, patch);
}

export function update(requestMeta, patch) {
  return db.docUpdate(requestMeta, patch);
}

export function getByParentId(parentId) {
  return db.getWhere(type, { parentId });
}

export async function getOrCreateByParentId(parentId) {
  const requestMeta = await getByParentId(parentId);

  if (requestMeta) {
    return requestMeta;
  }

  return create({ parentId });
}

export function all() {
  return db.all(type);
}
