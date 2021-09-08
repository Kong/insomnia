import { database as db } from '../common/database';
import { isGrpcRequest } from './grpc-request';
import type { BaseModel } from './index';
import { Project } from './project';
import { isRequest } from './request';
import type { RequestGroup } from './request-group';
import type { Workspace } from './workspace';

export const name = 'Stats';

export const type = 'Stats';

export const prefix = 'sta';

export const canDuplicate = false;

export const canSync = false;

interface BaseStats {
  currentLaunch: number | null;
  lastLaunch: number | null;
  currentVersion: string | null;
  lastVersion: string | null;
  launches: number;
  createdRequests: number;
  deletedRequests: number;
  executedRequests: number;
}

export type Stats = BaseModel & BaseStats;

export const isStats = (model: Pick<BaseModel, 'type'>): model is Stats => (
  model.type === type
);

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

export function migrate(doc: Stats) {
  return doc;
}

export function create(patch: Partial<Stats> = {}) {
  return db.docCreate<Stats>(type, patch);
}

export async function update(patch: Partial<Stats>) {
  const stats = await get();
  return db.docUpdate<Stats>(stats, patch);
}

export async function get() {
  const results = await db.all<Stats>(type) || [];

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
}: Partial<Stats>) {
  const stats = await get();
  await update({
    ...(createdRequests && {
      createdRequests: stats.createdRequests + createdRequests,
    }),
    ...(deletedRequests && {
      deletedRequests: stats.deletedRequests + deletedRequests,
    }),
    ...(executedRequests && {
      executedRequests: stats.executedRequests + executedRequests,
    }),
  });
}

export async function incrementCreatedRequests() {
  await incrementRequestStats({
    createdRequests: 1,
  });
}

export async function incrementDeletedRequests() {
  await incrementRequestStats({
    deletedRequests: 1,
  });
}

export async function incrementExecutedRequests() {
  await incrementRequestStats({
    executedRequests: 1,
  });
}

export async function incrementCreatedRequestsForDescendents(doc: Workspace | RequestGroup) {
  const docs = await db.withDescendants(doc);
  const requests = docs.filter(doc => isRequest(doc) || isGrpcRequest(doc));
  await incrementRequestStats({
    createdRequests: requests.length,
  });
}

export async function incrementDeletedRequestsForDescendents(doc: Workspace | RequestGroup | Project) {
  const docs = await db.withDescendants(doc);
  const requests = docs.filter(doc => isRequest(doc) || isGrpcRequest(doc));
  await incrementRequestStats({
    deletedRequests: requests.length,
  });
}
