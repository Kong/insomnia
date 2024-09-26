import type { RequestTestResult } from 'insomnia-sdk';

import { database as db } from '../common/database';
import type { RunnerSource } from '../ui/routes/request';
import type { BaseModel } from './index';

export const name = 'Runner Test Result';

export const type = 'RunnerTestResult';

export const prefix = 'rtr';

export const canDuplicate = false;

export const canSync = false;

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
  source: RunnerSource;
  iterations: number;
  duration: number; // millisecond
  avgRespTime: number; // millisecond
  iterationResults: RunnerResultPerRequestPerIteration;
  responsesInfo: ResponseInfo[];
  version: '1'; // We might want to add or remove result features in future
}

export type RunnerTestResult = BaseModel & BaseRunnerTestResult;

export const isRunnerTestResult = (model: Pick<BaseModel, 'type'>): model is RunnerTestResult => (
  model.type === type
);

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

export function migrate(doc: RunnerTestResult) {
  return doc;
}

export function create(patch: Partial<RunnerTestResult> = {}) {
  if (!patch.parentId) {
    throw new Error('New RunnerTestResult missing `parentId` ' + JSON.stringify(patch));
  }

  return db.docCreate(type, patch);
}

export function update(testResult: RunnerTestResult, patch: Partial<RunnerTestResult>) {
  return db.docUpdate(testResult, patch);
}

export function getByParentId(parentId: string) {
  return db.getWhere<RunnerTestResult>(type, { parentId });
}

export function getLatestByParentId(parentId: string) {
  return db.getMostRecentlyModified<RunnerTestResult>(type, { parentId });
}

export function getById(_id: string) {
  return db.getWhere<RunnerTestResult>(type, {
    _id,
  });
}

export function all() {
  return db.all<RunnerTestResult>(type);
}

export function remove(item: RunnerTestResult) {
  return db.remove<RunnerTestResult>(item);
}

export function findByParentId(parentId: string) {
  return db.find<RunnerTestResult>(type, { parentId: parentId });
}
