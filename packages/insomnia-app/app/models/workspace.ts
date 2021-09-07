import { Merge } from 'type-fest';

import { database as db } from '../common/database';
import { strings } from '../common/strings';
import type { BaseModel } from './index';
import * as models from './index';
import { DEFAULT_PROJECT_ID, isProjectId } from './project';

export const name = 'Workspace';
export const type = 'Workspace';
export const prefix = 'wrk';
export const canDuplicate = true;
export const canSync = true;

interface GenericWorkspace<Scope extends 'design' | 'collection'> {
  name: string;
  description: string;
  certificates?: any;
  scope: Scope;
}

export type DesignWorkspace = GenericWorkspace<'design'>;
export type CollectionWorkspace = GenericWorkspace<'collection'>;
export type BaseWorkspace = DesignWorkspace | CollectionWorkspace;

export type WorkspaceScope = BaseWorkspace['scope'];

export const WorkspaceScopeKeys = {
  design: 'design',
  collection: 'collection',
} as const;

export type Workspace = BaseModel & BaseWorkspace;

export const isWorkspace = (model: Pick<BaseModel, 'type'>): model is Workspace => (
  model.type === type
);

export const isDesign = (workspace: Pick<Workspace, 'scope'>): workspace is DesignWorkspace => (
  workspace.scope === WorkspaceScopeKeys.design
);

export const isCollection = (workspace: Pick<Workspace, 'scope'>): workspace is CollectionWorkspace => (
  workspace.scope === WorkspaceScopeKeys.collection
);

export const init = (): BaseWorkspace => ({
  name: `New ${strings.collection.singular}`,
  description: '',
  scope: WorkspaceScopeKeys.collection,
});

export async function migrate(doc: Workspace) {
  doc = await _migrateExtractClientCertificates(doc);
  doc = await _migrateEnsureName(doc);
  await models.apiSpec.getOrCreateForParentId(doc._id, {
    fileName: doc.name,
  });
  doc = _migrateScope(doc);
  doc = _migrateIntoDefaultProject(doc);
  return doc;
}

export function getById(id?: string) {
  return db.get<Workspace>(type, id);
}

export function findByParentId(parentId: string) {
  return db.find<Workspace>(type, { parentId });
}

export async function create(patch: Partial<Workspace> = {}) {
  expectParentToBeProject(patch.parentId);
  return db.docCreate<Workspace>(type, patch);
}

export async function all() {
  return await db.all<Workspace>(type);
}

export function count() {
  return db.count(type);
}

export function update(workspace: Workspace, patch: Partial<Workspace>) {
  expectParentToBeProject(patch.parentId);
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

// Translate the old value
type OldScopeTypes = 'spec' | 'debug' | 'designer' | null;
type MigrationWorkspace = Merge<Workspace, { scope: OldScopeTypes | Workspace['scope'] }>;

/**
 * Ensure workspace scope is set to a valid entry
 */
function _migrateScope(workspace: MigrationWorkspace) {
  switch (workspace.scope) {
    case WorkspaceScopeKeys.collection:
    case WorkspaceScopeKeys.design:
      break;

    case 'designer':
    case 'spec':
      workspace.scope = WorkspaceScopeKeys.design;
      break;

    case 'debug':
    case null:
    default:
      workspace.scope = WorkspaceScopeKeys.collection;
      break;
  }
  return workspace as Workspace;
}

function _migrateIntoDefaultProject(workspace: Workspace) {
  if (!workspace.parentId) {
    workspace.parentId = DEFAULT_PROJECT_ID;
  }

  return workspace;
}

export async function ensureChildren({ _id }: Workspace) {
  await models.environment.getOrCreateForParentId(_id);
  await models.cookieJar.getOrCreateForParentId(_id);
  await models.workspaceMeta.getOrCreateByParentId(_id);
}

function expectParentToBeProject(parentId?: string | null) {
  if (parentId && !isProjectId(parentId)) {
    throw new Error('Expected the parent of a Workspace to be a Project');
  }
}
