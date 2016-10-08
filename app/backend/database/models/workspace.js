import * as db from '../index';
import {DEFAULT_SIDEBAR_WIDTH} from '../../constants';

export const type = 'Workspace';
export const prefix = 'wrk';
export function init () {
  return db.initModel({
    name: 'New Workspace',
    metaSidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    metaActiveEnvironmentId: null,
    metaActiveRequestId: null,
    metaFilter: '',
    metaSidebarHidden: false
  });
}

export function getById (id) {
  return db.get(type, id);
}

export function create (patch = {}) {
  return db.docCreate(type, patch);
}

export async function all () {
  const workspaces = await db.all(type);

  if (workspaces.length === 0) {
    await create({name: 'Insomnia'});
    return await all();
  } else {
    return workspaces;
  }
}

export function count () {
  return db.count(type)
}

export function update (workspace, patch) {
  return db.docUpdate(workspace, patch);
}

export function remove (workspace) {
  return db.remove(workspace);
}
