import type { RequestGroup } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const { type } = models.requestGroup;

export function create(patch: Partial<RequestGroup> = {}) {
  if (!patch.parentId) {
    throw new Error('New RequestGroup missing `parentId`: ' + JSON.stringify(patch));
  }

  return db.docCreate<RequestGroup>(type, patch);
}

export function update(requestGroup: RequestGroup, patch: Partial<RequestGroup> = {}) {
  return db.docUpdate<RequestGroup>(requestGroup, patch);
}

export function getById(id: string) {
  return db.findOne<RequestGroup>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<RequestGroup>(type, { parentId });
}

export function remove(requestGroup: RequestGroup) {
  return db.remove(requestGroup);
}

export function all() {
  return db.find<RequestGroup>(type);
}

export async function duplicate(requestGroup: RequestGroup, patch: Partial<RequestGroup> = {}) {
  if (!patch.name) {
    patch.name = `${requestGroup.name} (Copy)`;
  }

  const q = {
    metaSortKey: {
      $gt: requestGroup.metaSortKey,
    },
  };

  const [nextRequestGroup] = await db.find<RequestGroup>(type, q, {
    metaSortKey: 1,
  });

  const nextSortKey = nextRequestGroup ? nextRequestGroup.metaSortKey : requestGroup.metaSortKey + 100;

  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - requestGroup.metaSortKey) / 2;
  const metaSortKey = requestGroup.metaSortKey + sortKeyIncrement;
  return db.duplicate<RequestGroup>(requestGroup, {
    metaSortKey,
    ...patch,
  });
}
