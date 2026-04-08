import { database as db } from '~/common/database';
import type { Response } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import * as requestOperations from '~/models/helpers/request-operations';

import * as RequestVersionService from './request-version';
import * as SettingsService from './settings';

const { type } = models.response;

export function getById(id: string) {
  return db.findOne<Response>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<Response>(type, { parentId });
}

export async function all() {
  return db.find<Response>(type);
}

export async function getLatestForRequestId(
  requestId: string,
  environmentId: string | null,
): Promise<Response | undefined> {
  const shouldFilter = (await SettingsService.get()).filterResponsesByEnv;

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
  const request = await requestOperations.getById(parentId);
  const requestVersion = request ? await RequestVersionService.create(request) : null;
  patch.requestVersionId = requestVersion ? requestVersion._id : null;

  const settings = await SettingsService.get();
  const shouldQueryByEnvId = 'environmentId' in patch && settings.filterResponsesByEnv;
  const query = {
    parentId,
    ...(shouldQueryByEnvId ? { environmentId: patch.environmentId } : {}),
  };

  const responsesToShow = Math.max(1, maxResponses);
  const allResponses = await db.find<Response>(type, query, { modified: -1 }, responsesToShow);
  const recentIds = allResponses.map(response => response._id);

  await db.removeWhere(type, {
    ...query,
    _id: {
      $nin: recentIds,
    },
  });

  return db.docCreate(type, patch);
}
