import type { RequestTestResult } from 'insomnia-sdk';

import { database as db } from '../common/database';
import type { RunnerSource } from '../ui/routes/request';
import type { BaseModel } from './index';

export const name = 'Runner Test Result';

export const type = 'RunnerTestResult';

export const prefix = 'rtr';

export const canDuplicate = false;

export const canSync = false;

export interface BaseRunnerTestResult {
  source: RunnerSource;
  // environmentId: string;
  iterations: number;
  duration: number; // millisecond
  avgRespTime: number; // millisecond
  results: RequestTestResult[];
}

export type RunnerTestResult = BaseModel & BaseRunnerTestResult;

export const isRunnerTestResult = (model: Pick<BaseModel, 'type'>): model is RunnerTestResult => (
  model.type === type
);

export function init() {
  return {
    source: 'runner',
    // environmentId: string;
    iterations: 0,
    duration: 0,
    avgRespTime: 0,
    results: [],
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

export function findByParentId(parentId: string) {
  return db.find<RunnerTestResult>(type, { parentId: parentId });
}