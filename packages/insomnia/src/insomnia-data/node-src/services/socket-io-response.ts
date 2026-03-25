import { services } from '~/insomnia-data';
import { requestVersion as rv } from '~/models';
import * as requestOperations from '~/models/helpers/request-operations';

import { database as db } from '../../src/database';
import { models } from '../../src/models';
import { type SocketIOResponse } from '../../src/models/types';

const { type } = models.socketIoResponse;

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
  const requestVersion = request ? await rv.create(request) : null;
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
