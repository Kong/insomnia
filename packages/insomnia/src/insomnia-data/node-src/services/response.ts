import type { Response } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

import * as requestHelpers from './helpers/request-operations';
import * as requestVersionService from './request-version';
import * as settingsService from './settings';

const { type } = models.response;

export function getById(id: string) {
  return db.findOne<Response>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<Response>(type, { parentId: parentId });
}

export async function all() {
  return db.find<Response>(type);
}

export async function getLatestForRequestId(
  requestId: string,
  environmentId: string | null,
): Promise<Response | undefined> {
  // Filter responses by environment if setting is enabled
  const shouldFilter = (await settingsService.get()).filterResponsesByEnv;

  const response = await db.findOne<Response>(
    type,
    {
      parentId: requestId,
      ...(shouldFilter ? { environmentId } : {}),
    },
    { modified: -1 },
  );
  return response;
}

export async function create(patch: Partial<Response> = {}, maxResponses = 20): Promise<Response> {
  if (!patch.parentId) {
    console.log('[db] Attempted to create response without `parentId`', patch);
    throw new Error('New Response missing `parentId`');
  }

  const { parentId } = patch;
  // Create request version snapshot
  const request = await requestHelpers.getRequestById(parentId);
  const requestVersion = request ? await requestVersionService.create(request) : null;
  patch.requestVersionId = requestVersion ? requestVersion._id : null;
  // Filter responses by environment if setting is enabled
  const settings = await settingsService.get();
  const shouldQueryByEnvId = 'environmentId' in patch && settings.filterResponsesByEnv;
  const query = {
    parentId,
    ...(shouldQueryByEnvId ? { environmentId: patch.environmentId } : {}),
  };

  // Delete all other responses before creating the new one
  const responsesToShow = Math.max(1, maxResponses);

  const allResponses = await db.find<Response>(type, query, { modified: -1 }, responsesToShow);

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
