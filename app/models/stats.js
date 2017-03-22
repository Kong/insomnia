import * as db from '../common/database';

export const name = 'Stats';
export const type = 'Stats';
export const prefix = 'sta';
export const canDuplicate = false;

export function init () {
  return {
    lastLaunch: Date.now(),
    lastVersion: null,
    launches: 0
  };
}

export function migrate (doc) {
  return doc;
}

export function create (patch = {}) {
  return db.docCreate(type, patch);
}

export async function update (patch) {
  const stats = await get();
  return db.docUpdate(stats, patch);
}

export async function get () {
  const results = await db.all(type);
  if (results.length === 0) {
    return await create();
  } else {
    return results[0];
  }
}
