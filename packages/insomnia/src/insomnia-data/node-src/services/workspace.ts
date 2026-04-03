import { database as db } from '../../src/database';
import { models } from '../../src/models';
import { type Workspace } from '../../src/models/types';

const { type } = models.workspace;

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

function expectParentToBeProject(parentId?: string | null) {
  if (parentId && !models.project.isProjectId(parentId)) {
    throw new Error('Expected the parent of a Workspace to be a Project');
  }
}
