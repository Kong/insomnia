import type { Query, WorkspaceMeta } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';

const { type } = models.workspaceMeta;

export function list(query?: Query<WorkspaceMeta>, sort?: Record<string, any>, limit?: number) {
  return db.find<WorkspaceMeta>(type, query, sort, limit);
}

export const getById = (_id: string) => db.findOne<WorkspaceMeta>(type, { _id });

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

export async function getOrCreateByParentId(parentId: string) {
  const doc = await getByParentId(parentId);
  return doc || create({ parentId });
}
