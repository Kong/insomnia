import * as db from '../common/database';
import {PREVIEW_MODE_SOURCE} from '../common/constants';

export const name = 'Request Meta';
export const type = 'RequestMeta';
export const prefix = 'reqm';

export function init () {
  return {
    parentId: null,
    previewMode: PREVIEW_MODE_SOURCE,
    responseFilter: '',
    activeResponseId: null,
  }
}

export function migrate (doc) {
  return doc;
}

export function create (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New RequestMeta missing `parentId`', patch);
  }

  return db.docCreate(type, patch);
}

export function update (requestMeta, patch) {
  return db.docUpdate(requestMeta, patch);
}

export function getByParentId (parentId) {
  return db.getWhere(type, {parentId})
}

export function all () {
  return db.all(type);
}
