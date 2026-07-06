import type { Query, Workspace } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';

const { type } = models.workspace;

const _getWorkspaceByIdOrWorkspace = async (idOrWorkspace: string | Workspace) => {
  const workspace = typeof idOrWorkspace === 'string' ? await getById(idOrWorkspace) : idOrWorkspace;
  if (!workspace) {
    throw new Error(
      `Workspace not found: ${typeof idOrWorkspace === 'string' ? idOrWorkspace : `_id=${idOrWorkspace._id}, name=${idOrWorkspace.name}`}`,
    );
  }
  return workspace;
};

function _expectParentToBeProject(parentId?: string | null) {
  if (parentId && !models.project.isProjectId(parentId)) {
    throw new Error('Expected the parent of a Workspace to be a Project');
  }
}

export function list(query?: Query<Workspace>, sort?: Record<string, any>, limit?: number) {
  return db.find<Workspace>(type, query, sort, limit);
}

export function get(query?: Query<Workspace>, sort?: Record<string, any>) {
  return db.findOne<Workspace>(type, query, sort);
}

export function getById(id?: string) {
  return get({ _id: id });
}

export function listByParentId(parentId: string) {
  return list({ parentId });
}

export function count(query?: Query<Workspace>) {
  return db.count(type, query);
}

export async function create(patch: Partial<Workspace> = {}) {
  _expectParentToBeProject(patch.parentId);
  return db.docCreate<Workspace>(type, patch);
}

export async function update(idOrWorkspace: string | Workspace, patch: Partial<Workspace>) {
  const workspace = await _getWorkspaceByIdOrWorkspace(idOrWorkspace);
  _expectParentToBeProject(patch.parentId);
  return db.docUpdate(workspace, patch);
}

export async function upsert(workspace: Workspace) {
  _expectParentToBeProject(workspace.parentId);
  return db.update(workspace as Workspace);
}

export async function remove(idOrWorkspace: string | Workspace) {
  const workspace = await _getWorkspaceByIdOrWorkspace(idOrWorkspace);
  return db.remove(workspace);
}
