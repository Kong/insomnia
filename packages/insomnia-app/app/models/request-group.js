// @flow
import * as db from '../common/database';
import type { BaseModel } from './index';

export const name = 'Folder';
export const type = 'RequestGroup';
export const prefix = 'fld';
export const canDuplicate = true;

type BaseRequestGroup = {
  name: string,
  description: string,
  environment: Object,
  metaSortKey: number
};

export type RequestGroup = BaseModel & BaseRequestGroup;

export function init() {
  return {
    name: 'New Folder',
    description: '',
    environment: {},
    metaSortKey: -1 * Date.now()
  };
}

export function migrate(doc: RequestGroup) {
  return doc;
}

export function create(patch: Object = {}): Promise<RequestGroup> {
  if (!patch.parentId) {
    throw new Error(
      'New RequestGroup missing `parentId`: ' + JSON.stringify(patch)
    );
  }

  return db.docCreate(type, patch);
}

export function update(
  requestGroup: RequestGroup,
  patch: Object = {}
): Promise<RequestGroup> {
  return db.docUpdate(requestGroup, patch);
}

export function getById(id: string): Promise<RequestGroup | null> {
  return db.get(type, id);
}

export function findByParentId(parentId: string): Promise<Array<RequestGroup>> {
  return db.find(type, { parentId });
}

export function remove(requestGroup: RequestGroup): Promise<void> {
  return db.remove(requestGroup);
}

export function all(): Promise<Array<RequestGroup>> {
  return db.all(type);
}

export async function duplicate(
  requestGroup: RequestGroup
): Promise<RequestGroup> {
  const name = `${requestGroup.name} (Copy)`;

  // Get sort key of next request
  const q = { metaSortKey: { $gt: requestGroup.metaSortKey } };
  const [nextRequestGroup] = await db.find(type, q, { metaSortKey: 1 });
  const nextSortKey = nextRequestGroup
    ? nextRequestGroup.metaSortKey
    : requestGroup.metaSortKey + 100;

  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - requestGroup.metaSortKey) / 2;
  const metaSortKey = requestGroup.metaSortKey + sortKeyIncrement;

  return db.duplicate(requestGroup, { name, metaSortKey });
}
