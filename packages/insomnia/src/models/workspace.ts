import type { Merge } from 'type-fest';

import { database as db } from '../common/database';
import { strings } from '../common/strings';
import * as clientCertificate from './client-certificate';
import { isProjectId } from './project';
import type { BaseModel } from './types';

export const name = 'Workspace';
export const type = 'Workspace';
export const prefix = 'wrk';
export const canDuplicate = true;
export const canSync = true;

export interface BaseWorkspace {
  name: string;
  description: string;
  certificates?: any; // deprecated
  scope: 'design' | 'collection' | 'mock-server' | 'environment' | 'mcp';
}

export type WorkspaceScope = BaseWorkspace['scope'];

export const WorkspaceScopeKeys = {
  design: 'design',
  collection: 'collection',
  mockServer: 'mock-server',
  environment: 'environment',
  mcp: 'mcp',
} as const;

export type Workspace = BaseModel & BaseWorkspace;

export const isWorkspace = (model: Pick<BaseModel, 'type'>): model is Workspace => model.type === type;

export const isDesign = (workspace: Pick<Workspace, 'scope'>) => workspace.scope === WorkspaceScopeKeys.design;

export const isCollection = (workspace: Pick<Workspace, 'scope'>) => workspace.scope === WorkspaceScopeKeys.collection;

export const isMockServer = (workspace: Pick<Workspace, 'scope'>) => workspace.scope === WorkspaceScopeKeys.mockServer;

export const isEnvironment = (workspace: Pick<Workspace, 'scope'>) =>
  workspace.scope === WorkspaceScopeKeys.environment;

export const isMcp = (workspace: Pick<Workspace, 'scope'>) => workspace.scope === WorkspaceScopeKeys.mcp;

export const init = (): BaseWorkspace => ({
  name: `New ${strings.collection.singular}`,
  description: '',
  scope: WorkspaceScopeKeys.collection,
});

export function migrate(doc: Workspace) {
  try {
    doc = _migrateExtractClientCertificates(doc);
    doc = _migrateEnsureName(doc);
    doc = _migrateScope(doc);
    return doc;
  } catch (e) {
    console.log('[db] Error during workspace migration', e);
    throw e;
  }
}

export function getById(id?: string) {
  return db.findOne<Workspace>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<Workspace>(type, { parentId });
}

export async function create(patch: Partial<Workspace> = {}) {
  expectParentToBeProject(patch.parentId);
  return db.docCreate<Workspace>(type, patch);
}

export async function all() {
  return await db.find<Workspace>(type);
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

function _migrateExtractClientCertificates(workspace: Workspace) {
  const certificates = workspace.certificates || null;

  if (!Array.isArray(certificates)) {
    // Already migrated
    return workspace;
  }

  for (const cert of certificates) {
    clientCertificate.create({
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
  return workspace;
}

/**
 * Ensure workspace has a valid String name. Due to real-world bug reports, we know
 * this happens (and it causes problems) so this migration will ensure that it is
 * corrected.
 */
function _migrateEnsureName(workspace: Workspace) {
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
  if (
    workspace.scope === WorkspaceScopeKeys.design ||
    workspace.scope === WorkspaceScopeKeys.collection ||
    workspace.scope === WorkspaceScopeKeys.mockServer ||
    workspace.scope === WorkspaceScopeKeys.environment ||
    workspace.scope === WorkspaceScopeKeys.mcp
  ) {
    return workspace as Workspace;
  }
  // designer and spec => design, unset => collection
  workspace.scope =
    workspace.scope === 'designer' || workspace.scope === 'spec'
      ? WorkspaceScopeKeys.design
      : WorkspaceScopeKeys.collection;
  return workspace as Workspace;
}

function expectParentToBeProject(parentId?: string | null) {
  if (parentId && !isProjectId(parentId)) {
    throw new Error('Expected the parent of a Workspace to be a Project');
  }
}

export const SCRATCHPAD_WORKSPACE_ID = 'wrk_scratchpad';

export function isScratchpad(workspace?: Workspace) {
  return workspace?._id === SCRATCHPAD_WORKSPACE_ID;
}

export const scopeToActivity = (scope: WorkspaceScope) => {
  switch (scope) {
    case WorkspaceScopeKeys.collection: {
      return 'debug';
    }
    case WorkspaceScopeKeys.design: {
      return 'spec';
    }
    case WorkspaceScopeKeys.mockServer: {
      return 'mock-server';
    }
    case WorkspaceScopeKeys.environment: {
      return 'environment';
    }
    case WorkspaceScopeKeys.mcp: {
      return 'mcp';
    }
    default: {
      return 'debug';
    }
  }
};
