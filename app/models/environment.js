import * as db from '../common/database';

export const name = 'Environment';
export const type = 'Environment';
export const prefix = 'env';
export function init () {
  return {
    name: 'New Environment',
    data: {},
  }
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
  const parentId = workspace._id;
  const environments = await db.find(type, {parentId});

  if (environments.length === 0) {
    return await create({
      parentId,
      name: 'Base Environment'
    })
  } else {
    return environments[0];
  }
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
