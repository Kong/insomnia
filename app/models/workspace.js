// @flow
import type {BaseModel} from './index';
import * as db from '../common/database';

export const name = 'Workspace';
export const type = 'Workspace';
export const prefix = 'wrk';
export const canDuplicate = true;

type BaseWorkspace = {
  name: string,
  description: string,
  certificates: Array<{
    host: string,
    passphrase: string,
    cert: string,
    key: string,
    pfx: string
  }>
};

export type Workspace = BaseWorkspace & BaseModel;

export function init () {
  return {
    name: 'New Workspace',
    description: '',
    certificates: [
      // {host, port, cert, key, pfx, passphrase}
    ]
  };
}

export function migrate (doc: Object) {
  // There was a bug on import that would set this to the current workspace ID.
  // Let's remove it here so that nothing bad happens.
  if (doc.parentId !== null) {
    // Save it to the DB for this one
    process.nextTick(() => update(doc, {parentId: null}));
  }

  return doc;
}

export function getById (id: string): Promise<Workspace | null> {
  return db.get(type, id);
}

export function create (patch: Object = {}): Promise<Workspace> {
  return db.docCreate(type, patch);
}

export async function all (): Promise<Array<Workspace>> {
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

export function update (workspace: Workspace, patch: Object): Promise<Workspace> {
  return db.docUpdate(workspace, patch);
}

export function remove (workspace: Workspace): Promise<void> {
  return db.remove(workspace);
}
