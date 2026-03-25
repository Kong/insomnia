import { services } from '~/insomnia-data';

import { database as db } from '../common/database';
import * as requestOperations from './helpers/request-operations';
import * as models from './index';
import type { BaseModel } from './types';

export const name = 'SocketIO Response';

export const type = 'SocketIOResponse';

export const prefix = 'socketIO-res';

export const canDuplicate = false;

export const canSync = false;

export interface BaseSocketIOResponse {
  // Event logs are stored on the filesystem
  eventLogPath: string;
  // Actual timelines are stored on the filesystem
  timelinePath: string;
  requestVersionId: string | null;
  environmentId: string | null;
  elapsedTime: number;
  error: string;
  url: string;
}

export type SocketIOResponse = BaseModel & BaseSocketIOResponse;

export const isSocketIOResponse = (model: Pick<BaseModel, 'type'>): model is SocketIOResponse => model.type === type;

export function init(): BaseSocketIOResponse {
  return {
    timelinePath: '',
    eventLogPath: '',
    requestVersionId: null,
    environmentId: null,
    elapsedTime: 0,
    error: '',
    url: '',
  };
}

export function migrate(doc: SocketIOResponse) {
  return doc;
}

export function update(doc: SocketIOResponse, patch: Partial<SocketIOResponse>) {
  return db.docUpdate(doc, patch);
}

export function getById(id: string) {
  return db.findOne<SocketIOResponse>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<SocketIOResponse>(type, { parentId: parentId });
}

export async function all() {
  return db.find<SocketIOResponse>(type);
}

export async function create(patch: Partial<SocketIOResponse> = {}, maxResponses = 20) {
  if (!patch.parentId) {
    throw new Error('New Response missing `parentId`');
  }

  const { parentId } = patch;
  // Create request version snapshot
  const request = await requestOperations.getById(parentId);
  const requestVersion = request ? await models.requestVersion.create(request) : null;
  patch.requestVersionId = requestVersion ? requestVersion._id : null;
  // Filter responses by environment if setting is enabled
  const query: Record<string, any> = {
    parentId,
  };

  if ((await services.settings.get()).filterResponsesByEnv && 'environmentId' in patch) {
    query.environmentId = patch.environmentId;
  }

  // Delete all other responses before creating the new one
  const allResponses = await db.find<SocketIOResponse>(type, query, { modified: -1 }, Math.max(1, maxResponses));
  const recentIds = allResponses.map(r => r._id);
  // Remove all that were in the last query, except the first `maxResponses` IDs
  await db.removeWhere(type, {
    ...query,
    _id: {
      $nin: recentIds,
    },
  });
  // Actually create the new response
  return db.docCreate(type, patch);
}

export async function getLatestForRequestId(requestId: string, environmentId: string | null) {
  // Filter responses by environment if setting is enabled

  const shouldFilter = (await services.settings.get()).filterResponsesByEnv;

  const response = await db.findOne<SocketIOResponse>(
    type,
    {
      parentId: requestId,
      ...(shouldFilter ? { environmentId } : {}),
    },
    { modified: -1 },
  );
  return response;
}
