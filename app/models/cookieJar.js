import * as db from '../common/database';

export const name = 'Cookie Jar';
export const type = 'CookieJar';
export const prefix = 'jar';
export function init () {
  return {
    name: 'Default Jar',
    cookies: []
  }
}

export function create (patch = {}) {
  return db.docCreate(type, patch);
}

export async function getOrCreateForWorkspace (workspace) {
  const parentId = workspace._id;
  const cookieJars = await db.find(type, {parentId});
  if (cookieJars.length === 0) {
    return await create({parentId})
  } else {
    return cookieJars[0];
  }
}

export function all () {
  return db.all(type);
}

export function getById (id) {
  return db.get(type, id);
}

export function update (cookieJar, patch) {
  return db.docUpdate(cookieJar, patch);
};
