import { database as db, models, type Response, services } from '~/insomnia-data';

import * as requestVersionOperations from './request-version';
import * as settingsOperations from './settings';

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
  const shouldFilter = (await settingsOperations.get()).filterResponsesByEnv;

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
  const request = await services.helpers.getRequestById(parentId);
  const requestVersion = request ? await requestVersionOperations.create(request) : null;
  patch.requestVersionId = requestVersion ? requestVersion._id : null;
  // Filter responses by environment if setting is enabled
  const settings = await settingsOperations.get();
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
