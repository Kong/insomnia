// @flow
import * as db from '../common/database';
import type { BaseModel } from './index';

export const name = 'Unit Test Result';
export const type = 'UnitTestResult';
export const prefix = 'utr';
export const canDuplicate = true;
export const canSync = true;

type BaseUnitTestResult = {
  test: string,

  // Points to Workspace
  parentId: string,

  // Points to Response that triggered it. Will be null if it was run
  // manually on its own.
  responseId: string | null,

  results: Object,
};

export type UnitTestResult = BaseModel & BaseUnitTestResult;

export function init() {
  return {
    parentId: null,
    responseId: null,
    test: '',
    results: null,
  };
}

export function migrate(doc: UnitTestResult): UnitTestResult {
  return doc;
}

export function create(patch: $Shape<UnitTestResult> = {}) {
  if (!patch.parentId) {
    throw new Error('New UnitTestResult missing `parentId` ' + JSON.stringify(patch));
  }

  return db.docCreate(type, patch);
}

export function update(unitTest: UnitTestResult, patch: $Shape<UnitTestResult>) {
  return db.docUpdate(unitTest, patch);
}

export function getByParentId(parentId: string) {
  return db.getWhere(type, { parentId });
}

export function all(): Promise<Array<UnitTestResult>> {
  return db.all(type);
}
