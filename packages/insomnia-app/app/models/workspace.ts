import type { BaseModel } from './index';
import * as models from './index';
import { database as db } from '../common/database';
import { getAppName } from '../common/constants';
import { strings } from '../common/strings';
import { ValueOf } from 'type-fest';
import { isSpaceId } from './helpers/is-model';

export const name = 'Workspace';

export const type = 'Workspace';

export const prefix = 'wrk';

export const canDuplicate = true;

export const canSync = true;

export const WorkspaceScopeKeys = {
  design: 'design',
  collection: 'collection',
} as const;

export type WorkspaceScope = ValueOf<typeof WorkspaceScopeKeys>;

interface BaseWorkspace {
  name: string;
  description: string;
  scope: WorkspaceScope;
  certificates?: any;
}

export type Workspace = BaseModel & BaseWorkspace;

export function init() {
  return {
    name: `New ${strings.collection.singular}`,
    description: '',
    scope: WorkspaceScopeKeys.collection,
  };
}

export async function migrate(doc: Workspace) {
  doc = await _migrateExtractClientCertificates(doc);
  doc = await _migrateEnsureName(doc);
  await models.apiSpec.getOrCreateForParentId(doc._id, {
    fileName: doc.name,
  });
  doc = _migrateScope(doc);
  return doc;
}

export function getById(id?: string) {
  return db.get<Workspace>(type, id);
}

export async function create(patch: Partial<Workspace> = {}) {
  expectParentToBeSpace(patch.parentId);
  return db.docCreate<Workspace>(type, patch);
}

export async function all() {
  const workspaces = await db.all<Workspace>(type) || [];

  if (workspaces.length === 0) {
    // Create default workspace
    await create({
      name: getAppName(),
      scope: WorkspaceScopeKeys.collection,
    });
    return all();
  } else {
    return workspaces;
  }
}

export function count() {
  return db.count(type);
}

export function update(workspace: Workspace, patch: Partial<Workspace>) {
  expectParentToBeSpace(patch.parentId);
  return db.docUpdate(workspace, patch);
}

export function remove(workspace: Workspace) {
  return db.remove(workspace);
}

async function _migrateExtractClientCertificates(workspace: Workspace) {
  const certificates = workspace.certificates || null;

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

  delete workspace.certificates;
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
async function _migrateEnsureName(workspace: Workspace) {
  if (typeof workspace.name !== 'string') {
    workspace.name = 'My Workspace';
  }

  return workspace;
}

/**
 * Ensure workspace scope is set to a valid entry
 */
function _migrateScope(workspace: Workspace) {
  if (
    workspace.scope === WorkspaceScopeKeys.design ||
    workspace.scope === WorkspaceScopeKeys.collection
  ) {
    return workspace;
  }

  // Translate the old value
  type OldScopeTypes = 'spec' | 'debug' | 'designer' | null;

  switch (workspace.scope as OldScopeTypes) {
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

function expectParentToBeSpace(parentId?: string | null) {
  if (parentId && !isSpaceId(parentId)) {
    throw new Error('Expected the parent of a Workspace to be a Space');
  }
}
