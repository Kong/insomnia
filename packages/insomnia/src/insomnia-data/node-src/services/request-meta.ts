import type { RequestMeta } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const { type } = models.requestMeta;

export function create(patch: Partial<RequestMeta> = {}) {
  if (!patch.parentId) {
    throw new Error('New RequestMeta missing `parentId` ' + JSON.stringify(patch));
  }

  return db.docCreate<RequestMeta>(type, patch);
}

export function update(requestMeta: RequestMeta, patch: Partial<RequestMeta>) {
  return db.docUpdate<RequestMeta>(requestMeta, patch);
}

export function getByParentId(parentId: string): Promise<RequestMeta | undefined> {
  return db.findOne<RequestMeta>(type, { parentId });
}

export async function getOrCreateByParentId(parentId: string) {
  const requestMeta = await getByParentId(parentId);

  if (requestMeta) {
    return requestMeta;
  }

  return create({ parentId });
}

export async function updateOrCreateByParentId(parentId: string, patch: Partial<RequestMeta>) {
  const requestMeta = await getByParentId(parentId);

  if (requestMeta) {
    return update(requestMeta, patch);
  }
  const newPatch = Object.assign(
    {
      parentId,
    },
    patch,
  );
  return create(newPatch);
}

export function all() {
  return db.find<RequestMeta>(type);
}
