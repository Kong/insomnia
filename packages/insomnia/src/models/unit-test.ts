import { databaseSchema } from '~/models/schema';

import { database as db } from '../common/database';
import type { BaseModel } from './index';

const type = databaseSchema.UnitTest.type;

interface BaseUnitTest {
  name: string;
  code: string;
  requestId: string | null;
  metaSortKey: number;
}

export type UnitTest = BaseModel & BaseUnitTest;

export const isUnitTest = (model: Pick<BaseModel, 'type'>): model is UnitTest => model.type === type;

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
