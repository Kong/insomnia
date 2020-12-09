// @flow
import * as db from '../common/database';
import type { BaseModel } from './index';
import type { Workspace } from './workspace';
import type { RequestGroup } from './request-group';
import { isRequest, isGrpcRequest } from './helpers/is-model';

export const name = 'Stats';
export const type = 'Stats';
export const prefix = 'sta';
export const canDuplicate = false;
export const canSync = false;

type BaseStats = {
  currentLaunch: number | null,
  lastLaunch: number | null,
  currentVersion: string | null,
  lastVersion: string | null,
  launches: number,
  createdRequests: number,
  deletedRequests: number,
  executedRequests: number,
};

export type Stats = BaseModel & BaseStats;

export function init(): BaseStats {
  return {
    currentLaunch: null,
    lastLaunch: null,
    currentVersion: null,
    lastVersion: null,
    launches: 0,
    createdRequests: 0,
    deletedRequests: 0,
    executedRequests: 0,
  };
}

export function migrate(doc: Stats): Stats {
  return doc;
}

export function create(patch: $Shape<Stats> = {}): Promise<Stats> {
  return db.docCreate(type, patch);
}

export async function update(patch: $Shape<Stats>): Promise<Stats> {
  const stats = await get();
  return db.docUpdate(stats, patch);
}

export async function get(): Promise<Stats> {
  const results = await db.all(type);
  if (results.length === 0) {
    return create();
  } else {
    return results[0];
  }
}

export async function incrementRequestStats({
  createdRequests,
  deletedRequests,
  executedRequests,
}: $Shape<Stats>) {
  const stats = await get();
  await update({
    ...(createdRequests && { createdRequests: stats.createdRequests + createdRequests }),
    ...(deletedRequests && { deletedRequests: stats.deletedRequests + deletedRequests }),
    ...(executedRequests && { executedRequests: stats.executedRequests + executedRequests }),
  });
}

export async function incrementCreatedRequests() {
  await incrementRequestStats({ createdRequests: 1 });
}

export async function incrementDeletedRequests() {
  await incrementRequestStats({ deletedRequests: 1 });
}

export async function incrementExecutedRequests() {
  await incrementRequestStats({ executedRequests: 1 });
}

export async function incrementCreatedRequestsForDescendents(doc: Workspace | RequestGroup) {
  const docs = await db.withDescendants(doc);
  const requests = docs.filter(doc => isRequest(doc) || isGrpcRequest(doc));
  await incrementRequestStats({ createdRequests: requests.length });
}

export async function incrementDeletedRequestsForDescendents(doc: Workspace | RequestGroup) {
  const docs = await db.withDescendants(doc);
  const requests = docs.filter(doc => isRequest(doc) || isGrpcRequest(doc));
  await incrementRequestStats({ deletedRequests: requests.length });
}
