import * as db from '../common/database';

export const name = 'Folder';
export const type = 'RequestGroup';
export const prefix = 'fld';
export const canDuplicate = true;

export function init () {
  return {
    name: 'New Folder',
    environment: {},
    metaSortKey: -1 * Date.now()
  };
}

export function migrate (doc) {
  return doc;
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
  return db.find(type, {parentId});
}

export function remove (requestGroup) {
  return db.remove(requestGroup);
}

export function all () {
  return db.all(type);
}

export async function duplicate (requestGroup) {
  const name = `${requestGroup.name} (Copy)`;

  // Get sort key of next request
  const q = {metaSortKey: {$gt: requestGroup.metaSortKey}};
  const [nextRequestGroup] = await db.find(type, q, {metaSortKey: 1});
  const nextSortKey = nextRequestGroup
    ? nextRequestGroup.metaSortKey
    : requestGroup.metaSortKey + 100;

  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - requestGroup.metaSortKey) / 2;
  const metaSortKey = requestGroup.metaSortKey + sortKeyIncrement;

  return db.duplicate(requestGroup, {name, metaSortKey});
}
