import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Unit Test Suite';

export const type = 'UnitTestSuite';

export const prefix = 'uts';

export const canDuplicate = true;

export const canSync = true;
export interface BaseUnitTestSuite {
  name: string;
}

export type UnitTestSuite = BaseModel & BaseUnitTestSuite;

export const isUnitTestSuite = (model: Pick<BaseModel, 'type'>): model is UnitTestSuite => (
  model.type === type
);

export function init() {
  return {
    name: 'My Test',
  };
}

export function migrate(doc: UnitTestSuite) {
  return doc;
}

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
  return db.getWhere<UnitTestSuite>(type, { parentId });
}

export function findByParentId(parentId: string) {
  return db.find<UnitTestSuite>(type, { parentId });
}

export const getById = (_id: string) => db.getWhere<UnitTestSuite>(type, { _id });

export function all() {
  return db.all<UnitTestSuite>(type);
}
