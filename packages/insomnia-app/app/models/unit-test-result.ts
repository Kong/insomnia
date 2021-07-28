import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Unit Test Result';

export const type = 'UnitTestResult';

export const prefix = 'utr';

export const canDuplicate = false;

export const canSync = false;

interface BaseUnitTestResult {
  results: Record<string, any>;
}

export type UnitTestResult = BaseModel & BaseUnitTestResult;

export const isUnitTestResult = (model: Pick<BaseModel, 'type'>): model is UnitTestResult => (
  model.type === type
);

export function init() {
  return {
    results: null,
  };
}

export function migrate(doc: UnitTestResult) {
  return doc;
}

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
  return db.getWhere(type, { parentId });
}

export function all() {
  return db.all<UnitTestResult>(type);
}
