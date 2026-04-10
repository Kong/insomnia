import { database as db } from '../../src/database';
import { models } from '../../src/models';
import { type MockRoute } from '../../src/models/types';

const { type } = models.mockRoute;

export function create(patch: Partial<MockRoute> = {}) {
  if (!patch.parentId) {
    throw new Error('New MockRoute missing `parentId`: ' + JSON.stringify(patch));
  }

  return db.docCreate<MockRoute>(type, patch);
}

export function update(mockRoute: MockRoute, patch: Partial<MockRoute> = {}) {
  return db.docUpdate<MockRoute>(mockRoute, patch);
}

export function getById(id: string) {
  return db.findOne<MockRoute>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<MockRoute>(type, { parentId });
}

export function removeWhere(parentId: string) {
  return db.removeWhere(type, { parentId });
}

export function remove(mockRoute: MockRoute) {
  return db.remove(mockRoute);
}

export function all() {
  return db.find<MockRoute>(type);
}
