import * as db from '../common/database';

export const name = 'Environment';
export const type = 'Environment';
export const prefix = 'env';
export const canDuplicate = true;
export function init () {
  return {
    name: 'New Environment',
    data: {},
    color: null,
    isPrivate: false
  };
}

export function migrate (doc) {
  return doc;
}

export function create (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New Environment missing `parentId`', patch);
  }

  return db.docCreate(type, patch);
}

export function update (environment, patch) {
  return db.docUpdate(environment, patch);
}

export function findByParentId (parentId) {
  return db.find(type, {parentId});
}

export async function getOrCreateForWorkspace (workspace) {
  let environment = await db.getWhere(type, {
    parentId: workspace._id
  });

  if (!environment) {
    environment = await create({
      parentId: workspace._id,
      name: 'Base Environment'
    });
  }

  return environment;
}

export function getById (id) {
  return db.get(type, id);
}

export function remove (environment) {
  return db.remove(environment);
}

export function all () {
  return db.all(type);
}
