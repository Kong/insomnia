// @flow
import * as db from '../common/database';
import type { BaseModel } from './index';

export const name = 'Unit Test';
export const type = 'UnitTest';
export const prefix = 'ut';
export const canDuplicate = true;
export const canSync = true;

type BaseUnitTest = {
  name: string,
  code: string,
  requestId: string | null,
};

export type UnitTest = BaseModel & BaseUnitTest;

export function init() {
  return {
    requestId: null,
    name: 'My Test',
    code: '',
  };
}

export function migrate(doc: UnitTest): UnitTest {
  return doc;
}

export function create(patch: $Shape<UnitTest> = {}): Promise<UnitTest> {
  if (!patch.parentId) {
    throw new Error('New UnitTest missing `parentId` ' + JSON.stringify(patch));
  }

  return db.docCreate(type, patch);
}

export function remove(unitTest: UnitTest): Promise<void> {
  return db.remove(unitTest);
}

export function update(unitTest: UnitTest, patch: $Shape<UnitTest> = {}): Promise<UnitTest> {
  return db.docUpdate(unitTest, patch);
}

export function getByParentId(parentId: string): Promise<UnitTest | null> {
  return db.getWhere(type, { parentId });
}

export function all(): Promise<Array<UnitTest>> {
  return db.all(type);
}
