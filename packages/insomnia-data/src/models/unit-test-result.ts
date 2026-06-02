import type { Stats } from 'mocha';

import type { BaseModel } from './base-types';

export const name = 'Unit Test Result';

export const type = 'UnitTestResult';

export const prefix = 'utr';

export const canDuplicate = false;

export const canSync = false;

interface TestErr {
  generatedMessage: boolean;
  name: string;
  code: string;
  actual: string;
  expected: string;
  operator: string;
}

interface NodeErr {
  message: string;
  stack: string;
}

export interface TestResult {
  id: string;
  title: string;
  fullTitle: string;
  file?: string;
  duration?: number;
  currentRetry: number;
  err: TestErr | NodeErr | {};
}

export interface TestResults {
  failures: TestResult[];
  passes: TestResult[];
  pending: TestResult[];
  stats: Stats;
  tests: TestResult[];
}

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
