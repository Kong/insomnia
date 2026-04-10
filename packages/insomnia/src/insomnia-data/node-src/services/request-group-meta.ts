import type { RequestGroupMeta } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const { type } = models.requestGroupMeta;

export function create(patch: Partial<RequestGroupMeta> = {}) {
  if (!patch.parentId) {
    throw new Error('New RequestGroupMeta missing `parentId`: ' + JSON.stringify(patch));
  }

  return db.docCreate<RequestGroupMeta>(type, patch);
}

export function update(requestGroupMeta: RequestGroupMeta, patch: Partial<RequestGroupMeta>) {
  return db.docUpdate<RequestGroupMeta>(requestGroupMeta, patch);
}

export function getByParentId(parentId: string) {
  return db.findOne<RequestGroupMeta>(type, { parentId });
}

export async function updateByParentId(parentId: string, patch: Partial<RequestGroupMeta> = {}) {
  const meta = await getByParentId(parentId);
  return meta && db.docUpdate<RequestGroupMeta>(meta, patch);
}

export function all() {
  return db.find<RequestGroupMeta>(type);
}
