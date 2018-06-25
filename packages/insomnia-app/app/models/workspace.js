// @flow
import type { BaseModel } from './index';
import * as db from '../common/database';
import * as models from './index';

export const name = 'Workspace';
export const type = 'Workspace';
export const prefix = 'wrk';
export const canDuplicate = true;

type BaseWorkspace = {
  name: string,
  description: string
};

export type Workspace = BaseModel & BaseWorkspace;

export function init() {
  return {
    name: 'New Workspace',
    description: ''
  };
}

export async function migrate(doc: Workspace): Promise<Workspace> {
  return _migrateExtractClientCertificates(doc);
}

export function getById(id: string): Promise<Workspace | null> {
  return db.get(type, id);
}

export async function create(patch: Object = {}): Promise<Workspace> {
  return db.docCreate(type, patch);
}

export async function all(): Promise<Array<Workspace>> {
  const workspaces = await db.all(type);

  if (workspaces.length === 0) {
    await create({ name: 'Insomnia' });
    return all();
  } else {
    return workspaces;
  }
}

export function count() {
  return db.count(type);
}

export function update(
  workspace: Workspace,
  patch: Object
): Promise<Workspace> {
  return db.docUpdate(workspace, patch);
}

export function remove(workspace: Workspace): Promise<void> {
  return db.remove(workspace);
}

async function _migrateExtractClientCertificates(
  workspace: Workspace
): Promise<Workspace> {
  const certificates = (workspace: Object).certificates || null;
  if (!Array.isArray(certificates)) {
    // Already migrated
    return workspace;
  }

  for (const cert of certificates) {
    await models.clientCertificate.create({
      parentId: workspace._id,
      host: cert.host || '',
      passphrase: cert.passphrase || null,
      cert: cert.cert || null,
      key: cert.key || null,
      pfx: cert.pfx || null,
      isPrivate: false
    });
  }

  delete (workspace: Object).certificates;

  // This will remove the now-missing `certificates` property
  // NOTE: Using db.update so we don't change things like modified time
  await db.update(workspace);

  return workspace;
}
