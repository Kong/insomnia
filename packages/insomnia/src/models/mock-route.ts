import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Mock Route';

export const type = 'MockRoute';

export const prefix = 'mock';

export const canDuplicate = true;

export const canSync = true;

interface BaseMockRoute {
  body: string;
  headers: Record<string, string>;
  method: string;
  parentId: string;
  path: string;
  statusCode: number;
}

export type MockRoute = BaseModel & BaseMockRoute;

export function init(): BaseMockRoute {
  return {
    body: '',
    headers: {},
    method: 'GET',
    parentId: '',
    path: '',
    statusCode: 200,
  };
}

export const isMockRoute = (model: Pick<BaseModel, 'type'>): model is MockRoute => (
  model.type === type
);

export function migrate(doc: MockRoute) {
  return doc;
}

export function create(patch: Partial<MockRoute> = {}) {
  if (!patch.parentId) {
    throw new Error('New MockRoute missing `parentId`: ' + JSON.stringify(patch));
  }

  return db.docCreate<MockRoute>(type, patch);
}

export function update(
  mockRoute: MockRoute,
  patch: Partial<MockRoute> = {},
) {
  return db.docUpdate<MockRoute>(mockRoute, patch);
}

export function getById(id: string) {
  return db.get<MockRoute>(type, id);
}

export function findByParentId(parentId: string) {
  return db.getWhere<MockRoute>(type, { parentId });
}

export function removeWhere(parentId: string) {
  return db.removeWhere(type, { parentId });
}

export function remove(mockRoute: MockRoute) {
  return db.remove(mockRoute);
}

export function all() {
  return db.all<MockRoute>(type);
}
