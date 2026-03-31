import { database as db, models, type WebSocketResponse } from 'insomnia-data';

import * as requestServices from './request';
import * as requestVersionServices from './request-version';
import * as settingsServices from './settings';

const { type } = models.webSocketResponse;

export function getById(id: string) {
  return db.findOne<WebSocketResponse>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<WebSocketResponse>(type, { parentId: parentId });
}

export async function all() {
  return db.find<WebSocketResponse>(type);
}

export async function create(patch: Partial<WebSocketResponse> = {}, maxResponses = 20) {
  if (!patch.parentId) {
    throw new Error('New Response missing `parentId`');
  }

  const { parentId } = patch;
  // Create request version snapshot
  const request = await requestServices.getById(parentId);
  const requestVersion = request ? await requestVersionServices.create(request) : null;
  patch.requestVersionId = requestVersion ? requestVersion._id : null;
  // Filter responses by environment if setting is enabled
  const query: Record<string, any> = {
    parentId,
  };

  if ((await settingsServices.get()).filterResponsesByEnv && 'environmentId' in patch) {
    query.environmentId = patch.environmentId;
  }

  // Delete all other responses before creating the new one
  const responsesToShow = Math.max(1, maxResponses);

  const allResponses = await db.find<WebSocketResponse>(type, query, { modified: -1 }, responsesToShow);

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

  const shouldFilter = (await settingsServices.get()).filterResponsesByEnv;

  const response = await db.findOne<WebSocketResponse>(
    type,
    {
      parentId: requestId,
      ...(shouldFilter ? { environmentId } : {}),
    },
    { modified: -1 },
  );
  return response;
}
