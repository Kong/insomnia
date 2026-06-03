import type { BaseModel } from './base-types';

export const name = 'Unit Test Suite';

export const type = 'UnitTestSuite';

export const prefix = 'uts';

export const canDuplicate = true;

export const canSync = true;

export interface BaseUnitTestSuite {
  name: string;
  metaSortKey: number;
}

export type UnitTestSuite = BaseModel & BaseUnitTestSuite;

export const isUnitTestSuite = (model: Pick<BaseModel, 'type'>): model is UnitTestSuite => model.type === type;

export function init() {
  return {
    name: 'My Test',
    metaSortKey: -1 * Date.now(),
  };
}
