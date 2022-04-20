import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Unit Test';

export const type = 'UnitTest';

export const prefix = 'ut';

export const canDuplicate = true;

export const canSync = true;
interface BaseUnitTest {
  name: string;
  code: string;
  requestId: string | null;
}

export type UnitTest = BaseModel & BaseUnitTest;

export const isUnitTest = (model: Pick<BaseModel, 'type'>): model is UnitTest => (
  model.type === type
);

export function init() {
  return {
    requestId: null,
    name: 'My Test',
    code: '',
  };
}

export function migrate(doc: UnitTest) {
  return doc;
}

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
  return db.getWhere<UnitTest>(type, { parentId });
}

export function all() {
  return db.all<UnitTest>(type);
}
