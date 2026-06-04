import type { UnitTestSuite } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';

const { type } = models.unitTestSuite;

export function create(patch: Partial<UnitTestSuite> = {}) {
  if (!patch.parentId) {
    throw new Error('New UnitTestSuite missing `parentId` ' + JSON.stringify(patch));
  }

  return db.docCreate<UnitTestSuite>(type, patch);
}

export function update(unitTestSuite: UnitTestSuite, patch: Partial<UnitTestSuite> = {}) {
  return db.docUpdate<UnitTestSuite>(unitTestSuite, patch);
}

export function remove(unitTestSuite: UnitTestSuite) {
  return db.remove(unitTestSuite);
}

export function getByParentId(parentId: string) {
  return db.findOne<UnitTestSuite>(type, { parentId });
}

export function findByParentId(parentId: string) {
  return db.find<UnitTestSuite>(type, { parentId });
}

export const getById = (_id: string) => db.findOne<UnitTestSuite>(type, { _id });

export function all() {
  return db.find<UnitTestSuite>(type);
}
