import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Folder';

export const type = 'RequestGroup';

export const prefix = 'fld';

export const canDuplicate = true;

export const canSync = true;
interface BaseRequestGroup {
  name: string;
  description: string;
  environment: Record<string, any>;
  environmentPropertyOrder: Record<string, any> | null;
  metaSortKey: number;
}

export type RequestGroup = BaseModel & BaseRequestGroup;

export const isRequestGroup = (model: Pick<BaseModel, 'type'>): model is RequestGroup => (
  model.type === type
);

export function init(): BaseRequestGroup {
  return {
    name: 'New Folder',
    description: '',
    environment: {},
    environmentPropertyOrder: null,
    metaSortKey: -1 * Date.now(),
  };
}

export function migrate(doc: RequestGroup) {
  return doc;
}

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
  return db.get<RequestGroup>(type, id);
}

export function findByParentId(parentId: string) {
  return db.find<RequestGroup>(type, { parentId });
}

export function remove(requestGroup: RequestGroup) {
  return db.remove(requestGroup);
}

export function all() {
  return db.all<RequestGroup>(type);
}

export async function duplicate(requestGroup: RequestGroup, patch: Partial<RequestGroup> = {}) {
  if (!patch.name) {
    patch.name = `${requestGroup.name} (Copy)`;
  }

  // Get sort key of next request
  const q = {
    metaSortKey: {
      $gt: requestGroup.metaSortKey,
    },
  };

  // @ts-expect-error -- TSCONVERSION appears to be a genuine error
  const [nextRequestGroup] = await db.find<RequestGroup>(type, q, {
    metaSortKey: 1,
  });

  const nextSortKey = nextRequestGroup
    ? nextRequestGroup.metaSortKey
    : requestGroup.metaSortKey + 100;

  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - requestGroup.metaSortKey) / 2;
  const metaSortKey = requestGroup.metaSortKey + sortKeyIncrement;
  return db.duplicate<RequestGroup>(requestGroup, {
    metaSortKey,
    ...patch,
  });
}

export const isRequestGroupId = (id: string) => id.startsWith(prefix);
