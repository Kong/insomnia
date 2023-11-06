import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Mock Server';

export const type = 'MockServer';

export const prefix = 'mock';

export const canDuplicate = true;

export const canSync = true;

interface BaseMockServer {
  parentId: string;
}

export type MockServer = BaseModel & BaseMockServer;

export function init(): BaseMockServer {
  return {
    parentId: '',
  };
}

export const isMockServer = (model: Pick<BaseModel, 'type'>): model is MockServer => (
  model.type === type
);

export function migrate(doc: MockServer) {
  return doc;
}

export function create(patch: Partial<MockServer> = {}) {
  if (!patch.parentId) {
    throw new Error('New MockServer missing `parentId`: ' + JSON.stringify(patch));
  }

  return db.docCreate<MockServer>(type, patch);
}

export function update(
  mockServer: MockServer,
  patch: Partial<MockServer> = {},
) {
  return db.docUpdate<MockServer>(mockServer, patch);
}

export function getById(id: string) {
  return db.get<MockServer>(type, id);
}

export function findByParentId(parentId: string) {
  return db.getWhere<MockServer>(type, { parentId });
}

export function removeWhere(parentId: string) {
  return db.removeWhere(type, { parentId });
}

export function remove(mockServer: MockServer) {
  return db.remove(mockServer);
}

export function all() {
  return db.all<MockServer>(type);
}
