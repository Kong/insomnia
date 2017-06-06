import * as db from '../common/database';

export const name = 'Workspace';
export const type = 'Workspace';
export const prefix = 'wrk';
export const canDuplicate = true;

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
  if (doc.parentId !== null) {
    // Save it to the DB for this one
    process.nextTick(() => update(doc, {parentId: null}));
  }

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
  return db.count(type);
}

export function update (workspace, patch) {
  return db.docUpdate(workspace, patch);
}

export function remove (workspace) {
  return db.remove(workspace);
}

export async function duplicate (workspace) {
  const name = `${workspace.name} (Copy)`;
  // Get sort key of next request
  const q = {metaSortKey: {$gt: workspace.metaSortKey}};
  const [nextRequest] = await db.find(type, q, {metaSortKey: 1});
  const nextSortKey = nextRequest ? nextRequest.metaSortKey : workspace.metaSortKey + 100;

  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - workspace.metaSortKey) / 2;
  const metaSortKey = workspace.metaSortKey + sortKeyIncrement;

  return db.duplicate(workspace, {name, metaSortKey});
}
