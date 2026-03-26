import type { TestResults } from 'insomnia-testing';

import type { BaseModel } from '~/models/types';

export const name = 'Unit Test Result';

export const type = 'UnitTestResult';

export const prefix = 'utr';

export const canDuplicate = false;

export const canSync = false;

export interface BaseUnitTestResult {
  results: TestResults;
}

export type UnitTestResult = BaseModel & BaseUnitTestResult;

export const isUnitTestResult = (model: Pick<BaseModel, 'type'>): model is UnitTestResult => model.type === type;

export function init() {
  return {
    results: null,
  };
}
