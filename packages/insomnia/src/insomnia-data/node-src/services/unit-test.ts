import { database as db } from '../../src/database';
import { models } from '../../src/models';
import type { UnitTest } from '../../src/models/types';

const { type } = models.unitTest;

export function create(patch: Partial<UnitTest> = {}) {
  if (!patch.parentId) {
    throw new Error('New UnitTest missing `parentId` ' + JSON.stringify(patch));
  }

  return db.docCreate<UnitTest>(type, patch);
}

export function remove(unitTest: UnitTest) {
  return db.remove(unitTest);
}

export function update(unitTest: UnitTest, patch: Partial<UnitTest> = {}) {
  return db.docUpdate<UnitTest>(unitTest, patch);
}

export function getByParentId(parentId: string) {
  return db.findOne<UnitTest>(type, { parentId });
}

export function all() {
  return db.find<UnitTest>(type);
}
