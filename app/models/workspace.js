import * as db from '../common/database';

export const name = 'Workspace';
export const type = 'Workspace';
export const prefix = 'wrk';

export function init () {
  return {
    name: 'New Workspace',
    description: '',
    certificates: [
      // {host, port, cert, key, pfx, passphrase}
    ]
  };
}

export function migrate (doc) {
  // There was a bug on import that would set this to the current workspace ID.
  // Let's remove it here so that nothing bad happens.
  doc.parentId = null;

  return doc;
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
