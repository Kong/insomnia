import * as db from '../common/database';
import {DEFAULT_SIDEBAR_WIDTH, DEFAULT_PANE_WIDTH} from '../common/constants';

export const name = 'Workspace Meta';
export const type = 'WorkspaceMeta';
export const prefix = 'wrkm';
export const canDuplicate = true;

export function init () {
  return {
    parentId: null,
    activeRequestId: null,
    activeEnvironmentId: null,
    sidebarFilter: '',
    sidebarHidden: false,
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    paneWidth: DEFAULT_PANE_WIDTH
  };
}

export function migrate (doc) {
  return doc;
}

export function create (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New WorkspaceMeta missing `parentId`', patch);
  }

  return db.docCreate(type, patch);
}

export function update (workspaceMeta, patch) {
  return db.docUpdate(workspaceMeta, patch);
}

export function getByParentId (parentId) {
  return db.getWhere(type, {parentId});
}

export function all () {
  return db.all(type);
}
