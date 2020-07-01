// @flow
import * as db from '../common/database';
import type { BaseModel } from './index';

export const name = 'Unit Test Suite';
export const type = 'UnitTestSuite';
export const prefix = 'uts';
export const canDuplicate = true;
export const canSync = true;

type BaseUnitTestSuite = {
  name: string,
};

export type UnitTestSuite = BaseModel & BaseUnitTestSuite;

export function init() {
  return {
    name: 'My Test',
  };
}

export function migrate(doc: UnitTestSuite): UnitTestSuite {
  return doc;
}

export function create(patch: $Shape<UnitTestSuite> = {}) {
  if (!patch.parentId) {
    throw new Error('New UnitTestSuite missing `parentId` ' + JSON.stringify(patch));
  }

  return db.docCreate(type, patch);
}

export function update(
  unitTestSuite: UnitTestSuite,
  patch: $Shape<UnitTestSuite> = {},
): Promise<UnitTestSuite> {
  return db.docUpdate(unitTestSuite, patch);
}

export function remove(unitTestSuite: UnitTestSuite): Promise<void> {
  return db.remove(unitTestSuite);
}

export function getByParentId(parentId: string): Promise<UnitTestSuite | null> {
  return db.getWhere(type, { parentId });
}

export function all(): Promise<Array<UnitTestSuite>> {
  return db.all(type);
}
