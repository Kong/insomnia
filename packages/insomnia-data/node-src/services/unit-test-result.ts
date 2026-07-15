import type { UnitTestResult } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';

const { type } = models.unitTestResult;

export function create(patch: Partial<UnitTestResult> = {}) {
  if (!patch.parentId) {
    throw new Error('New UnitTestResult missing `parentId` ' + JSON.stringify(patch));
  }

  return db.docCreate(type, patch);
}

export function update(unitTest: UnitTestResult, patch: Partial<UnitTestResult>) {
  return db.docUpdate(unitTest, patch);
}

export function getByParentId(parentId: string) {
  return db.findOne<UnitTestResult>(type, { parentId });
}

export function getById(_id: string) {
  return db.findOne<UnitTestResult>(type, {
    _id,
  });
}

export function all() {
  return db.find<UnitTestResult>(type);
}
