// @flow
import type { BaseModel } from './index';
import * as models from './index';
import * as db from '../common/database';
import { getAppName } from '../common/constants';
import { strings } from '../common/strings';

export const name = 'Workspace';
export const type = 'Workspace';
export const prefix = 'wrk';
export const canDuplicate = true;
export const canSync = true;

export const WorkspaceScopeKeys = {
  design: 'design',
  collection: 'collection',
};

export type WorkspaceScope = $Keys<typeof WorkspaceScopeKeys>;

type BaseWorkspace = {
  name: string,
  description: string,
  scope: WorkspaceScope,
};

export type Workspace = BaseModel & BaseWorkspace;

export function init() {
  return {
    name: `New ${strings.collection}`,
    description: '',
    scope: WorkspaceScopeKeys.collection,
  };
}

export async function migrate(doc: Workspace): Promise<Workspace> {
  doc = await _migrateExtractClientCertificates(doc);
  doc = await _migrateEnsureName(doc);
  await models.apiSpec.getOrCreateForParentId(doc._id, { fileName: doc.name });
  doc = _migrateScope(doc);
  return doc;
}

export function getById(id: string): Promise<Workspace | null> {
  return db.get(type, id);
}

export async function create(patch: $Shape<Workspace> = {}): Promise<Workspace> {
  return db.docCreate(type, patch);
}

export async function all(): Promise<Array<Workspace>> {
  const workspaces = await db.all(type);

  if (workspaces.length === 0) {
    // Create default workspace
    await create({ name: getAppName(), scope: WorkspaceScopeKeys.collection });
    return all();
  } else {
    return workspaces;
  }
}

export function count() {
  return db.count(type);
}

export function update(workspace: Workspace, patch: $Shape<Workspace>): Promise<Workspace> {
  return db.docUpdate(workspace, patch);
}

export function remove(workspace: Workspace): Promise<void> {
  return db.remove(workspace);
}

async function _migrateExtractClientCertificates(workspace: Workspace): Promise<Workspace> {
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
      isPrivate: false,
    });
  }

  delete (workspace: Object).certificates;

  // This will remove the now-missing `certificates` property
  // NOTE: Using db.update so we don't change things like modified time
  await db.update(workspace);

  return workspace;
}

/**
 * Ensure workspace has a valid String name. Due to real-world bug reports, we know
 * this happens (and it causes problems) so this migration will ensure that it is
 * corrected.
 */
async function _migrateEnsureName(workspace: Workspace): Promise<Workspace> {
  if (typeof workspace.name !== 'string') {
    workspace.name = 'My Workspace';
  }

  return workspace;
}

/**
 * Ensure workspace scope is set to a valid entry
 */
function _migrateScope(workspace: Workspace): Workspace {
  if (
    workspace.scope === WorkspaceScopeKeys.design ||
    workspace.scope === WorkspaceScopeKeys.collection
  ) {
    return workspace;
  }

  // Translate the old value
  type OldScopeTypes = 'spec' | 'debug' | 'designer' | null;
  switch ((workspace.scope: OldScopeTypes)) {
    case 'spec': {
      workspace.scope = WorkspaceScopeKeys.design;
      break;
    }
    case 'designer': {
      workspace.scope = WorkspaceScopeKeys.design;
      break;
    }
    case 'debug':
    case null:
    default:
      workspace.scope = WorkspaceScopeKeys.collection;
      break;
  }

  return workspace;
}
