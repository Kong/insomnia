import type { TestResults } from 'insomnia-testing';

import { databaseSchema } from '~/models/schema';

import { database as db } from '../common/database';
import type { BaseModel } from './index';

const type = databaseSchema.UnitTestResult.type;

export interface BaseUnitTestResult {
  results: TestResults;
}

export type UnitTestResult = BaseModel & BaseUnitTestResult;

export const isUnitTestResult = (model: Pick<BaseModel, 'type'>): model is UnitTestResult => model.type === type;

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
