import type { BaseModel } from './base-types';

export const name = 'Runner Test Result';

export const type = 'RunnerTestResult';

export const prefix = 'rtr';

export const canDuplicate = false;

export const canSync = false;

export type TestStatus = 'passed' | 'failed' | 'skipped';
export type TestCategory = 'unknown' | 'pre-request' | 'after-response';

export interface RequestTestResult {
  testCase: string;
  status: TestStatus;
  executionTime: number; // milliseconds
  errorMessage?: string;
  category: TestCategory;
}

export interface RunnerResultPerRequest {
  results: RequestTestResult[];
  requestName: string;
  requestUrl: string;
  responseCode: number;
}

export interface ResponseInfo {
  responseId: string;
  originalRequestName: string;
  originalRequestId: string;
}

export type RunnerResultPerRequestPerIteration = RunnerResultPerRequest[][];

export interface BaseRunnerTestResult {
  source: 'runner';
  iterations: number;
  duration: number; // millisecond
  avgRespTime: number; // millisecond
  iterationResults: RunnerResultPerRequestPerIteration;
  responsesInfo: ResponseInfo[];
  version: '1'; // We might want to add or remove result features in future
}

export type RunnerTestResult = BaseModel & BaseRunnerTestResult;

export const isRunnerTestResult = (model: Pick<BaseModel, 'type'>): model is RunnerTestResult => model.type === type;

export function init() {
  return {
    source: 'runner',
    iterations: 0,
    duration: 0,
    avgRespTime: 0,
    iterationResults: [],
    responsesInfo: [],
    version: '1',
  };
}
