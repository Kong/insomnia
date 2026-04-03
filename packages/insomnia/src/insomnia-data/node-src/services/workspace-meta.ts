import { database as db } from '../../src/database';
import { models } from '../../src/models';
import { type WorkspaceMeta } from '../../src/models/types';

const { type } = models.workspaceMeta;

export function create(patch: Partial<WorkspaceMeta> = {}) {
  if (!patch.parentId) {
    throw new Error(`New WorkspaceMeta missing parentId ${JSON.stringify(patch)}`);
  }

  return db.docCreate<WorkspaceMeta>(type, patch);
}

export function update(workspaceMeta: WorkspaceMeta, patch: Partial<WorkspaceMeta> = {}) {
  return db.docUpdate<WorkspaceMeta>(workspaceMeta, patch);
}

export async function updateByParentId(parentId: string, patch: Partial<WorkspaceMeta> = {}) {
  const meta = await getByParentId(parentId);
  return meta && db.docUpdate<WorkspaceMeta>(meta, patch);
}

export async function getByParentId(parentId: string) {
  return db.findOne<WorkspaceMeta>(type, { parentId });
}

export async function getByGitRepositoryId(gitRepositoryId: string) {
  return db.findOne<WorkspaceMeta>(type, { gitRepositoryId });
}

export async function getOrCreateByParentId(parentId: string) {
  const doc = await getByParentId(parentId);
  return doc || create({ parentId });
}

export function all() {
  return db.find<WorkspaceMeta>(type);
}
