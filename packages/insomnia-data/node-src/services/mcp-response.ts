import type { McpResponse } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';

import * as requestHelpers from './helpers/request-operations';
import * as requestVersionService from './request-version';
import * as settingsService from './settings';

const { type } = models.mcpResponse;

export function getById(id: string) {
  return db.findOne<McpResponse>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<McpResponse>(type, { parentId: parentId });
}

export async function all() {
  return db.find<McpResponse>(type);
}

export async function create(patch: Partial<McpResponse> = {}, maxResponses = 20) {
  if (!patch.parentId) {
    throw new Error('New Response missing `parentId`');
  }

  const { parentId } = patch;
  // Create request version snapshot
  const request = await requestHelpers.getRequestById(parentId);
  const requestVersion = request ? await requestVersionService.create(request) : null;
  patch.requestVersionId = requestVersion ? requestVersion._id : null;
  // Filter responses by environment if setting is enabled
  const query: Record<string, any> = {
    parentId,
  };

  if ((await settingsService.get()).filterResponsesByEnv && 'environmentId' in patch) {
    query.environmentId = patch.environmentId;
  }

  // Delete all other responses before creating the new one
  const responsesToShow = Math.max(1, maxResponses);

  const allResponses = await db.find<McpResponse>(type, query, { modified: -1 }, responsesToShow);

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

export async function updateOrCreate(patch: Partial<McpResponse>, maxResponses = 20) {
  const id = patch._id;
  if (!id) {
    throw new Error('Cannot updateOrCreate McpResponse without _id');
  }

  const existing = await getById(id);
  if (existing) {
    return db.docUpdate(existing, patch);
  }

  return create(patch, maxResponses);
}

export async function getLatestForRequestId(requestId: string, environmentId: string | null) {
  // Filter responses by environment if setting is enabled

  const shouldFilter = (await settingsService.get()).filterResponsesByEnv;

  const response = await db.findOne<McpResponse>(
    type,
    {
      parentId: requestId,
      ...(shouldFilter ? { environmentId } : {}),
    },
    { modified: -1 },
  );
  return response;
}
